import { useEffect, useRef } from 'react';
import { signIn } from '../firebase';
import { LogIn } from 'lucide-react';
import gsap from 'gsap';

export function Login() {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power4.out', duration: 1.2 } });

    tl.fromTo(containerRef.current, 
      { opacity: 0, y: 50, scale: 0.95 }, 
      { opacity: 1, y: 0, scale: 1 }
    )
    .fromTo(logoRef.current,
      { scale: 0, rotate: -45, opacity: 0 },
      { scale: 1, rotate: 0, opacity: 1 },
      '-=0.8'
    )
    .fromTo([titleRef.current, subtitleRef.current],
      { y: 30, skewY: 5, filter: 'blur(10px)', opacity: 0 },
      { y: 0, skewY: 0, filter: 'blur(0px)', opacity: 1, stagger: 0.1 },
      '-=0.6'
    )
    .fromTo(buttonRef.current,
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1 },
      '-=0.4'
    );
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#6366F1]/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#6366F1]/5 rounded-full blur-[120px]" />

      <div ref={containerRef} className="max-w-md w-full space-y-8 bg-white/[0.03] backdrop-blur-xl p-10 rounded-3xl border border-white/10 shadow-2xl relative z-10">
        <div className="text-center">
          <div ref={logoRef} className="mx-auto h-16 w-16 bg-[#6366F1] rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
            <span className="text-3xl font-black text-black">D</span>
          </div>
          <h2 ref={titleRef} className="text-3xl font-bold text-white tracking-tight">DakikTabela</h2>
          <p ref={subtitleRef} className="mt-2 text-white/40 font-medium">Ölçü & Keşif Yönetim Sistemi</p>
        </div>
        
        <div className="mt-10">
          <button
            ref={buttonRef}
            onClick={() => signIn()}
            className="group relative w-full flex justify-center py-4 px-4 border border-white/10 text-sm font-semibold rounded-2xl text-white bg-white/5 hover:bg-white/10 backdrop-blur-md transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6366F1]"
          >
            <span className="absolute left-0 inset-y-0 flex items-center pl-4">
              <LogIn className="h-5 w-5 text-white/40 group-hover:text-[#6366F1] transition-colors" />
            </span>
            Google ile Giriş Yap
          </button>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-xs text-white/20 uppercase tracking-widest font-bold">Kurumsal Üretim Çözümü</p>
        </div>
      </div>
    </div>
  );
}
