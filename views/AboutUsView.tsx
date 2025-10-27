import React from 'react';

const AboutUsView: React.FC = () => {
  return (
    <div className="bg-white p-8 md:p-12 rounded-lg shadow-xl max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800">
          About Cera Brasileira
        </h1>
        <p className="text-lg text-gray-600 mt-4">
          The Essence of Brazil’s Timeless Beauty Tradition
        </p>
      </div>
      
      <div className="w-24 h-1 bg-pink-500 mx-auto my-8 rounded"></div>

      <div className="prose prose-lg max-w-none mx-auto text-gray-700 leading-relaxed">
        <h2 className="text-3xl font-bold text-pink-600 mb-4 text-center">Our Story</h2>
        <p>
          Cera Brasileira is more than just a product – it’s a tradition. Our recipe has been passed down through generations in Brazil since 1992, carefully crafted with <strong className="text-pink-600">natural honey and propolis</strong> to provide smooth, effective, and gentle hair removal.
        </p>
        <p>
          We believe beauty should be simple, natural, and safe. That’s why our wax is free from harsh chemicals, preservatives, and artificial colors, making it suitable for both women and men, and safe even for pregnant and breastfeeding mothers.
        </p>
        <p>
          Today, Cera Brasileira continues to uphold the same values: authenticity, quality, and respect for nature. With every pack, we deliver the essence of Brazil’s timeless beauty tradition.
        </p>
      </div>

       <div className="mt-12 text-center">
        <img 
          src="https://placehold.co/800x400/FFF0F5/DB2777?text=Cera+Brasileira" 
          alt="Natural ingredients of Cera Brasileira wax" 
          className="rounded-lg shadow-md mx-auto"
        />
        <p className="text-sm text-gray-500 mt-2">Crafted with care since 1992.</p>
      </div>

    </div>
  );
};

export default AboutUsView;
