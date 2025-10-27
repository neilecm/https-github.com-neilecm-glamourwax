


import React from 'react';
import { AppView, View } from '../App';

interface FooterProps {
  onNavigate: (view: AppView) => void;
}

const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-white mt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div>
            <h3 className="text-xl font-bold text-pink-500 mb-4">Cera Brasileira</h3>
            <p className="text-gray-600">Your one-stop shop for premium waxing products.</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-4">Quick Links</h3>
            <ul>
              <li><button onClick={() => alert('About Us page coming soon!')} className="text-gray-600 hover:text-pink-500">About Us</button></li>
              <li><button onClick={() => onNavigate({ name: View.CONTACT })} className="text-gray-600 hover:text-pink-500">Contact</button></li>
              <li><button onClick={() => alert('FAQ page coming soon!')} className="text-gray-600 hover:text-pink-500">FAQ</button></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-700 mb-4">Follow Us</h3>
            <div className="flex justify-center md:justify-start space-x-4">
              <a href="#" className="text-gray-600 hover:text-pink-500">Instagram</a>
              <a href="#" className="text-gray-600 hover:text-pink-500">Facebook</a>
              <a href="#" className="text-gray-600 hover:text-pink-500">Twitter</a>
            </div>
          </div>
        </div>
        <div className="text-center text-gray-500 mt-8 pt-8 border-t border-gray-200">
          <p>&copy; {new Date().getFullYear()} Cera Brasileira. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;