import React from 'react';
import { AppView, View } from '../App';

interface FooterProps {
  onNavigate: (view: AppView) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="site-footer mt-16">
      <div className="container mx-auto px-4 py-8 text-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div>
            <h3 className="text-xl font-bold mb-4 text-[var(--honey-yellow)]">Cera Brasileira</h3>
            <p>Your one-stop shop for premium waxing products.</p>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul>
              <li><button onClick={() => onNavigate({ name: View.ABOUT_US })} className="hover:text-[var(--honey-yellow)]">About Us</button></li>
              <li><button onClick={() => onNavigate({ name: View.CONTACT })} className="hover:text-[var(--honey-yellow)]">Contact</button></li>
              <li><button onClick={() => alert('FAQ page coming soon!')} className="hover:text-[var(--honey-yellow)]">FAQ</button></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Follow Us</h3>
            <div className="flex justify-center md:justify-start space-x-4">
              <a href="#" className="hover:text-[var(--honey-yellow)]">Instagram</a>
              <a href="#" className="hover:text-[var(--honey-yellow)]">Facebook</a>
              <a href="#" className="hover:text-[var(--honey-yellow)]">TikTok</a>
              <a href="#" className="hover:text-[var(--honey-yellow)]">YouTube</a>
              <a href="#" className="hover:text-[var(--honey-yellow)]">Twitter</a>
            </div>
          </div>
        </div>
        <div className="text-center opacity-90 mt-8 pt-8 border-t border-white/20">
          <p>&copy; {new Date().getFullYear()} Cera Brasileira. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
