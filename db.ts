//Previous attempts at implementation of .sql files was going nowhere
//sqlite seems much, much easier to implement. I have wasted my time.
//better-sqlite was recommended by Papa Google AI.


import Database from "better-sqlite3";

const db = new Database("userdb.sqlite");

//Exportable function to insert users into the database
export function insertUser(user : any) 
{
    const stmt = db.prepare(`INSERT OR REPLACE INTO users
                                    (login, name, bio, public_repos, followers, following, created_at, updated_at, avatar_url)
                                    VALUES (?,?,?,?,?,?,?,?,?)`);
    stmt.run(user.login,user.name,user.bio,user.public_repos,user.followers,user.following,user.created_at,user.updated_at,user.avatar_url);
}
insertUser({login: "abcdefg", name: "Katie", bio: "sure", public_repos: 1, followers: 0, following: 0});

//Will create another table if this works. Just need something to work.
//Works in my DB Browser. Gonna see if I can hook it into the scraper.

