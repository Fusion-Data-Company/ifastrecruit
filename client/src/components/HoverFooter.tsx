import { useState } from 'react';

export function HoverFooter() {
  const [hoveredText, setHoveredText] = useState('');

  const footerTexts = [
    "Florida's Oldest & Largest Private Insurance Education Provider",
    "Supporting 9,000+ Brokers Throughout Florida",
    "Contact: TheInsuranceSchool@gmail.com",
    "Central Florida Insurance School: 407.332.6645"
  ];

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-black/80 border-t border-cyan-400/30 backdrop-blur-sm z-40">
      <div className="container mx-auto px-6 py-3">
        <div className="flex justify-between items-center text-cyan-400">
          <div className="flex gap-8">
            {footerTexts.map((text, idx) => (
              <span
                key={idx}
                className="text-sm hover:text-cyan-300 transition-all duration-300 hover:scale-110 cursor-default"
                onMouseEnter={() => setHoveredText(text)}
                onMouseLeave={() => setHoveredText('')}
                data-testid={`footer-text-${idx}`}
              >
                {text}
              </span>
            ))}
          </div>
          
          <div className="text-xs text-cyan-400/60">
            © {new Date().getFullYear()} The Insurance School
          </div>
        </div>

        {hoveredText && (
          <div className="mt-2 text-center text-cyan-300 text-lg font-semibold animate-pulse">
            {hoveredText}
          </div>
        )}
      </div>
    </footer>
  );
}
