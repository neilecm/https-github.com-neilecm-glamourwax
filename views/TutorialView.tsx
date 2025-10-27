import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const TutorialView: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold">Welcome, {profile?.full_name || 'Valued Customer'}!</h1>
        <p className="text-gray-600 mt-2">Here is your exclusive Brazilian Waxing tutorial.</p>
      </div>
      
      <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden shadow-md">
        {/* Replace this with your actual YouTube video embed code */}
        <iframe 
          width="560" 
          height="315" 
          src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1" // A classic tutorial link ;)
          title="YouTube video player" 
          frameBorder="0" 
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowFullScreen
          className="w-full h-full"
        ></iframe>
      </div>

      <div className="mt-8 text-gray-700 leading-relaxed">
        <h2 className="text-2xl font-semibold mb-4">Key Steps & Tips</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Preparation is Key:</strong> Ensure the hair is about 1/4 inch long for the best results.</li>
          <li><strong>Cleanse the Area:</strong> Start with clean, dry skin. Avoid lotions or oils before waxing.</li>
          <li><strong>Proper Application:</strong> Apply the wax in the direction of hair growth.</li>
          <li><strong>Quick Removal:</strong> Hold the skin taut and pull the strip off quickly in the opposite direction of hair growth.</li>
          <li><strong>Aftercare:</strong> Soothe the skin with a post-waxing oil or calming lotion to reduce redness.</li>
        </ul>
      </div>
    </div>
  );
};

export default TutorialView;
