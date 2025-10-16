import { SignInPage, Testimonial } from "@/components/ui/sign-in";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";
import iFastRecruitLogo from "@assets/D3A79AEA-5F31-45A5-90D2-AD2878D4A934_1760646767765.png";
import iFastRecruitHero from "@assets/10187C78-AFAE-44D3-AC48-CEDBE5FF44CC_1760647655713.png";

const testimonials: Testimonial[] = [
  {
    avatarSrc: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
    name: "Jason Perez",
    handle: "CEO & Founder",
    text: "Leading the future of insurance recruitment with AI-powered automation and seamless broker onboarding."
  },
  {
    avatarSrc: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop",
    name: "Neil Schwabe",
    handle: "Chief Operating Officer",
    text: "Building scalable systems that transform how we connect with Florida's top insurance talent."
  },
  {
    avatarSrc: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop",
    name: "Sebastian Andersen",
    handle: "VP of Strategic Growth",
    text: "Expanding our network across multiple states to create the premier insurance broker platform."
  },
];

function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, setLocation]);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  const handleGoogleSignIn = () => {
    // Redirect to Replit Auth login endpoint
    window.location.href = "/api/login";
  };

  const handleCreateAccount = () => {
    // For Replit Auth, creating account is same as logging in
    window.location.href = "/api/login";
  };

  // Since we're using Replit Auth, we'll customize the sign-in page
  // to only show the Google sign-in option
  return (
    <div className="h-[100dvh] flex flex-col md:flex-row font-geist w-[100dvw]">
      {/* Left column: sign-in form */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <div className="animate-element animate-delay-100 flex justify-center mb-4">
              <img 
                src={iFastRecruitLogo} 
                alt="iFast Recruit Logo" 
                className="h-20 w-auto object-contain"
              />
            </div>
            <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight text-center">
              <span className="font-serif font-light text-foreground tracking-tighter">
                Welcome to <span className="font-bold">iFast Recruit</span>
              </span>
            </h1>
            <p className="animate-element animate-delay-200 text-muted-foreground text-center">
              Sign in to access the enterprise insurance recruiting platform
            </p>

            <div className="animate-element animate-delay-300 space-y-6">
              <div className="glass-panel rounded-3xl p-8 border border-border/50 backdrop-blur-xl">
                <div className="text-center space-y-4">
                  <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Secure Authentication</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Powered by Replit's enterprise-grade OAuth
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleGoogleSignIn}
                className="animate-element animate-delay-400 w-full flex items-center justify-center gap-3 rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-all duration-200 transform hover:scale-[1.02]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
                  <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
                </svg>
                Sign in with Replit
              </button>

              <p className="animate-element animate-delay-500 text-center text-sm text-muted-foreground">
                New to our platform?{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleCreateAccount();
                  }}
                  className="text-violet-400 hover:underline transition-colors"
                >
                  Create Account
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Right column: hero image + testimonials */}
      <section className="hidden md:block flex-1 relative p-4">
        <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-black overflow-hidden">
          {/* Dark background for the branded image */}
          <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-black">
            {/* Centered branded image above cards */}
            <div className="flex items-center justify-center h-full pb-48">
              <img 
                src={iFastRecruitHero}
                alt="iFast Recruit - The Future of Recruiting"
                className="w-auto h-auto max-w-[80%] max-h-[50%] object-contain animate-fade-in"
              />
            </div>
          </div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className={`animate-testimonial animate-delay-${
                1000 + index * 200
              } flex items-start gap-3 rounded-3xl bg-card/40 dark:bg-zinc-800/40 backdrop-blur-xl border border-white/10 p-5 w-64 ${
                index === 1 ? "hidden xl:flex" : index === 2 ? "hidden 2xl:flex" : ""
              }`}
            >
              <img
                src={testimonial.avatarSrc}
                className="h-10 w-10 object-cover rounded-2xl"
                alt="avatar"
              />
              <div className="text-sm leading-snug">
                <p className="flex items-center gap-1 font-medium">{testimonial.name}</p>
                <p className="text-muted-foreground">{testimonial.handle}</p>
                <p className="mt-1 text-foreground/80">{testimonial.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default LoginPage;