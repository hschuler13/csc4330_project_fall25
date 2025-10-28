
function LoginPage() {
  return (
  <div className = "h-screen w-screen flex flex-col bg-linear-to-r from-blue-950 to-purple-950">
    <div className = "loginPage">
      <div className = "pt-15 flex items-center justify-center">
        <img 
        className = "logo size-100" 
        src = "src/assets/GitHub_Invertocat_Logo.svg.png"
        alt = "GitHub logo"
        />
      </div>
      <div className= "text-center text-[20px]">
        <h1> Welcome to GitTogether </h1>
        <p> Please login to your github account below to join </p>
      </div>
      <a href = "/AfterLogin">
      <button className="px-300 group relative flex items-center justify-center overflow-hidden rounded-md bg-neutral-950 font-medium text-neutral-50 mr-auto ml-auto">
        <span className="absolute h-0 w-0 rounded-full bg-blue-700 transition-all duration-300 group-hover:h-56 group-hover:w-64"></span>
        <span className="relative">Login with GitHub account</span>
      </button>
      </a>
    </div>
  </div>
  ) 
}

export default LoginPage