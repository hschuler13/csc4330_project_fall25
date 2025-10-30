"""
GFI (Good First Issue) ML Recommender - XGBoost Model
Trains on scraped GitHub data to predict which issues newcomers will successfully resolve
"""

import pandas as pd
import numpy as np
import json
from datetime import datetime
import xgboost as xgb
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix
from sklearn.feature_extraction.text import TfidfVectorizer
import joblib
import warnings
warnings.filterwarnings('ignore')

class GFIPredictor:
    def __init__(self):
        self.model = None
        self.label_encoders = {}
        self.tfidf_title = TfidfVectorizer(max_features=100, stop_words='english')
        self.tfidf_body = TfidfVectorizer(max_features=200, stop_words='english')
        self.feature_names = []
        
    def load_data(self, json_path='../data/scraped/scraped_data_graphql/gfi_training_data.json'):
        """Load the scraped GitHub data"""
        print("📊 Loading data from scraper output...")
        
        with open(json_path, 'r') as f:
            data = json.load(f)
        
        # Convert to DataFrame - FIXED: correct key name
        df = pd.DataFrame(data['closed_gfi_issues'])
        
        # FIXED: Handle null values properly
        df['is_newcomer_resolver'] = df['is_newcomer_resolver'].apply(
            lambda x: np.nan if x is None else x
        )
        df['resolver_commit_count_before_resolution'] = df['resolver_commit_count_before_resolution'].apply(
            lambda x: np.nan if x is None else x
        )
        
        # Print data stats
        print(f"Total issues loaded: {len(df)}")
        print(f"Issues resolved by newcomers: {df['is_newcomer_resolver'].sum():.0f}")
        print(f"Issues with GFI label: {df['has_gfi_label'].sum()}")
        print(f"High confidence resolutions: {(df['confidence_score'] == 'high').sum()}")
        
        return df, data.get('repo_stats', {})
    
    def engineer_features(self, df, repo_stats):
        """Create features for ML model"""
        print("\n🔧 Engineering features...")
        
        # Filter only issues with known resolvers
        df_known = df[df['is_newcomer_resolver'].notna()].copy()
        print(f"Issues with known resolver status: {len(df_known)}")
        
        # Optional: Weight by confidence (only use high/medium confidence data)
        if 'confidence_score' in df_known.columns:
            df_filtered = df_known[df_known['confidence_score'].isin(['high', 'medium'])].copy()
            if len(df_filtered) > 100:  # Only filter if we have enough data
                print(f"Filtering to high/medium confidence: {len(df_filtered)} issues")
                df_known = df_filtered
        
        # Basic features
        features = pd.DataFrame(index=df_known.index)
        
        # Text length features - handle potential None values
        features['title_length'] = df_known['title'].fillna('').str.len()
        features['body_length'] = df_known['body'].fillna('').str.len()
        features['title_word_count'] = df_known['title'].fillna('').str.split().str.len()
        features['body_word_count'] = df_known['body'].fillna('').str.split().str.len()
        
        # Label features
        features['num_labels'] = df_known['labels'].apply(len)
        features['has_gfi_label'] = df_known['has_gfi_label'].astype(int)
        
        # Check for common beginner-friendly label keywords
        def has_beginner_keywords(labels):
            keywords = ['easy', 'beginner', 'good', 'first', 'starter', 'newcomer', 'help wanted']
            label_text = ' '.join(labels).lower() if labels else ''
            return int(any(keyword in label_text for keyword in keywords))
        
        features['has_beginner_keywords'] = df_known['labels'].apply(has_beginner_keywords)
        
        # Issue metadata
        features['num_comments'] = df_known['num_comments'].fillna(0)
        
        # Time features - FIXED: handle None values in dates
        df_known['created_at'] = pd.to_datetime(df_known['created_at'], errors='coerce')
        df_known['closed_at'] = pd.to_datetime(df_known['closed_at'], errors='coerce')
        
        days_to_close = (df_known['closed_at'] - df_known['created_at']).dt.days
        features['days_to_close'] = days_to_close.fillna(days_to_close.median())
        
        # Add resolver commit count if available
        #if 'resolver_commit_count_before_resolution' in df_known.columns:
        #    features['resolver_commits'] = df_known['resolver_commit_count_before_resolution'].fillna(-1)
        
        # Repository features (encode repo name)
        if 'repo_name' not in self.label_encoders:
            self.label_encoders['repo_name'] = LabelEncoder()
            features['repo_encoded'] = self.label_encoders['repo_name'].fit_transform(df_known['repo_name'])
        else:
            features['repo_encoded'] = self.label_encoders['repo_name'].transform(df_known['repo_name'])
        
        # Confidence score as feature (if available)
        if 'confidence_score' in df_known.columns:
            confidence_map = {'high': 3, 'medium': 2, 'low': 1}
            features['confidence'] = df_known['confidence_score'].map(confidence_map).fillna(0)
        
        # TF-IDF features for title (top 20 features)
        print("  Extracting text features from titles...")
        title_tfidf = self.tfidf_title.fit_transform(df_known['title'].fillna(''))
        title_tfidf_df = pd.DataFrame(
            title_tfidf.toarray(), 
            columns=[f'title_tfidf_{i}' for i in range(title_tfidf.shape[1])],
            index=features.index
        )
        features = pd.concat([features, title_tfidf_df], axis=1)
        
        # TF-IDF features for body (top 30 features)
        print("  Extracting text features from descriptions...")
        body_tfidf = self.tfidf_body.fit_transform(df_known['body'].fillna(''))
        body_tfidf_df = pd.DataFrame(
            body_tfidf.toarray(),
            columns=[f'body_tfidf_{i}' for i in range(body_tfidf.shape[1])],
            index=features.index
        )
        features = pd.concat([features, body_tfidf_df], axis=1)
        
        # Target variable
        target = df_known['is_newcomer_resolver'].astype(int)
        
        # Store feature names for later
        self.feature_names = features.columns.tolist()
        
        print(f"  Created {len(self.feature_names)} features")
        print(f"  Training on {len(target)} samples")
        print(f"  Class balance: {target.value_counts().to_dict()}")
        
        return features, target
    
    def train_model(self, X, y):
        """Train XGBoost model with hyperparameter tuning"""
        print("\n🚀 Training XGBoost model...")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        print(f"  Training set: {len(X_train)} samples")
        print(f"  Test set: {len(X_test)} samples")
        
        # Calculate scale_pos_weight for imbalanced data
        scale_pos_weight = len(y_train[y_train == 0]) / len(y_train[y_train == 1])
        
        # Basic XGBoost model first
        print("\n  Training baseline model...")
        base_model = xgb.XGBClassifier(
            objective='binary:logistic',
            random_state=42,
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            scale_pos_weight=scale_pos_weight
        )
        
        base_model.fit(X_train, y_train)
        base_pred = base_model.predict(X_test)
        base_accuracy = accuracy_score(y_test, base_pred)
        print(f"  Baseline accuracy: {base_accuracy:.3f}")
        
        # Hyperparameter tuning
        print("\n  Tuning hyperparameters (this may take a few minutes)...")
        param_grid = {
            'max_depth': [4, 6],
            'learning_rate': [0.05, 0.1],
            'n_estimators': [100, 150],
            'subsample': [0.8],
            'colsample_bytree': [0.8, 1.0]
        }
        
        grid_search = GridSearchCV(
            xgb.XGBClassifier(
                objective='binary:logistic', 
                random_state=42,
                scale_pos_weight=scale_pos_weight
            ),
            param_grid,
            cv=3,
            scoring='f1',  # Use F1 score for imbalanced data
            n_jobs=-1,
            verbose=1
        )
        
        grid_search.fit(X_train, y_train)
        
        # Best model
        self.model = grid_search.best_estimator_
        print(f"\n  Best parameters: {grid_search.best_params_}")
        
        # Evaluate on test set
        y_pred = self.model.predict(X_test)
        y_pred_proba = self.model.predict_proba(X_test)[:, 1]
        
        # Calculate metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred)
        recall = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        
        print("\n📈 Model Performance:")
        print(f"  Accuracy:  {accuracy:.3f}")
        print(f"  Precision: {precision:.3f} (When we predict newcomer, we're right {precision*100:.1f}% of the time)")
        print(f"  Recall:    {recall:.3f} (We find {recall*100:.1f}% of actual newcomer issues)")
        print(f"  F1-Score:  {f1:.3f}")
        
        # Confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        print("\n  Confusion Matrix:")
        print(f"    True Negatives:  {cm[0,0]} (Correctly predicted NOT newcomer-friendly)")
        print(f"    False Positives: {cm[0,1]} (Wrongly predicted as newcomer-friendly)")
        print(f"    False Negatives: {cm[1,0]} (Missed newcomer-friendly issues)")
        print(f"    True Positives:  {cm[1,1]} (Correctly predicted newcomer-friendly)")
        
        # Feature importance (top 20)
        importance = self.model.feature_importances_
        indices = np.argsort(importance)[::-1][:20]
        
        print("\n🔍 Top 20 Most Important Features:")
        for i, idx in enumerate(indices):
            if idx < len(self.feature_names):
                print(f"  {i+1:2}. {self.feature_names[idx]:30} {importance[idx]:.4f}")
        
        # Compare with "good first issue" label accuracy
        if 'has_gfi_label' in X_test.columns:
            # GFI label as baseline predictor
            gfi_idx = self.feature_names.index('has_gfi_label')
            gfi_baseline = X_test.iloc[:, gfi_idx].values
            gfi_accuracy = accuracy_score(y_test, gfi_baseline)
            gfi_precision = precision_score(y_test, gfi_baseline, zero_division=0)
            gfi_recall = recall_score(y_test, gfi_baseline, zero_division=0)
            
            print(f"\n📊 Comparison with 'good first issue' label alone:")
            print(f"  GFI label accuracy: {gfi_accuracy:.3f}")
            print(f"  Our model accuracy: {accuracy:.3f}")
            if gfi_accuracy > 0:
                print(f"  Improvement: +{(accuracy - gfi_accuracy):.3f} ({(accuracy/gfi_accuracy - 1)*100:+.1f}%)")
            
            print(f"\n  GFI label precision: {gfi_precision:.3f}")
            print(f"  Our model precision: {precision:.3f}")
            if gfi_precision > 0:
                print(f"  Improvement: +{(precision - gfi_precision):.3f} ({(precision/gfi_precision - 1)*100:+.1f}%)")
    
    def predict_open_issues(self, open_issues_df):
        """Predict which open issues are good for newcomers"""
        print("\n🔮 Predicting newcomer-friendliness for open issues...")
        
        # FIXED: Complete feature engineering matching training
        features = pd.DataFrame(index=open_issues_df.index)
        
        # Text features
        features['title_length'] = open_issues_df['title'].fillna('').str.len()
        features['body_length'] = open_issues_df['body'].fillna('').str.len()
        features['title_word_count'] = open_issues_df['title'].fillna('').str.split().str.len()
        features['body_word_count'] = open_issues_df['body'].fillna('').str.split().str.len()
        
        # Label features
        features['num_labels'] = open_issues_df['labels'].apply(len)
        features['has_gfi_label'] = open_issues_df.get('has_gfi_label', 0).astype(int)
        
        def has_beginner_keywords(labels):
            keywords = ['easy', 'beginner', 'good', 'first', 'starter', 'newcomer', 'help wanted']
            label_text = ' '.join(labels).lower() if labels else ''
            return int(any(keyword in label_text for keyword in keywords))
        
        features['has_beginner_keywords'] = open_issues_df['labels'].apply(has_beginner_keywords)
        
        # Issue metadata
        features['num_comments'] = open_issues_df.get('num_comments', 0).fillna(0)
        
        # For open issues, we don't have days_to_close, so use days_open
        if 'created_at' in open_issues_df.columns:
            open_issues_df['created_at'] = pd.to_datetime(open_issues_df['created_at'], errors='coerce')
            days_open = (datetime.now() - open_issues_df['created_at']).dt.days
            features['days_to_close'] = days_open.fillna(30)  # Use median or default
        else:
            features['days_to_close'] = 30
        
        
        # Repository encoding
        if 'repo_name' in open_issues_df.columns and 'repo_name' in self.label_encoders:
            # Handle unknown repositories
            known_repos = set(self.label_encoders['repo_name'].classes_)
            repo_encoded = []
            for repo in open_issues_df['repo_name']:
                if repo in known_repos:
                    repo_encoded.append(self.label_encoders['repo_name'].transform([repo])[0])
                else:
                    repo_encoded.append(-1)  # Unknown repo
            features['repo_encoded'] = repo_encoded
        else:
            features['repo_encoded'] = 0
        
        # Confidence - not applicable for predictions
        features['confidence'] = 2  # Medium confidence default
        
        # TF-IDF features for title
        title_tfidf = self.tfidf_title.transform(open_issues_df['title'].fillna(''))
        title_tfidf_df = pd.DataFrame(
            title_tfidf.toarray(),
            columns=[f'title_tfidf_{i}' for i in range(title_tfidf.shape[1])],
            index=features.index
        )
        features = pd.concat([features, title_tfidf_df], axis=1)
        
        # TF-IDF features for body
        body_tfidf = self.tfidf_body.transform(open_issues_df['body'].fillna(''))
        body_tfidf_df = pd.DataFrame(
            body_tfidf.toarray(),
            columns=[f'body_tfidf_{i}' for i in range(body_tfidf.shape[1])],
            index=features.index
        )
        features = pd.concat([features, body_tfidf_df], axis=1)
        
        # Ensure all features are present and in correct order
        features = features.reindex(columns=self.feature_names, fill_value=0)
        
        # Get predictions
        predictions = self.model.predict_proba(features)[:, 1]
        
        # Add predictions to dataframe
        open_issues_df['newcomer_score'] = predictions
        
        # Return top recommendations
        top_issues = open_issues_df.nlargest(20, 'newcomer_score')
        
        print("\n🎯 Top 20 Recommended Issues for Newcomers:")
        for _, issue in top_issues.iterrows():
            title_preview = issue['title'][:50] + '...' if len(issue['title']) > 50 else issue['title']
            print(f"  {issue.get('repo_name', 'Unknown')}#{issue.get('issue_number', '?')}: {title_preview} (Score: {issue['newcomer_score']:.3f})")
        
        return top_issues
    
    def save_model(self, model_path='../model/gfi_predictor.pkl'):
        """Save the trained model and preprocessors"""
        import os
        os.makedirs('model', exist_ok=True)
        
        model_data = {
            'model': self.model,
            'label_encoders': self.label_encoders,
            'tfidf_title': self.tfidf_title,
            'tfidf_body': self.tfidf_body,
            'feature_names': self.feature_names
        }
        
        joblib.dump(model_data, model_path)
        print(f"\n💾 Model saved to {model_path}")
    
    def load_model(self, model_path='model/gfi_predictor.pkl'):
        """Load a trained model"""
        model_data = joblib.load(model_path)
        self.model = model_data['model']
        self.label_encoders = model_data['label_encoders']
        self.tfidf_title = model_data['tfidf_title']
        self.tfidf_body = model_data['tfidf_body']
        self.feature_names = model_data['feature_names']
        print(f"✅ Model loaded from {model_path}")


def main():
    """Main training pipeline"""
    print("=" * 60)
    print("🤖 GFI ML RECOMMENDER - TRAINING PIPELINE")
    print("=" * 60)
    
    # Initialize predictor
    predictor = GFIPredictor()
    
    # Load data
    df, repo_stats = predictor.load_data()
    
    # Engineer features
    X, y = predictor.engineer_features(df, repo_stats)
    
    # Train model
    predictor.train_model(X, y)
    
    # Save model
    predictor.save_model()
    
    print("\n" + "=" * 60)
    print("✅ Training complete! Model ready for predictions.")
    print("=" * 60)


if __name__ == "__main__":
    main()