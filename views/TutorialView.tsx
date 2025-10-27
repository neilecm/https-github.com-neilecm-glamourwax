import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Accordion Item Component for the FAQ section
const AccordionItem: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-left py-4 focus:outline-none"
                aria-expanded={isOpen}
            >
                <span className="font-semibold text-lg">{title}</span>
                <span className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </span>
            </button>
            {isOpen && (
                <div className="pb-4 text-gray-600 leading-relaxed">
                    {children}
                </div>
            )}
        </div>
    );
};

// Component for a single tutorial step with an image
const TutorialStep: React.FC<{ number: string, title: string, children: React.ReactNode, imageUrl: string }> = ({ number, title, children, imageUrl }) => (
    <div className="flex flex-col md:flex-row gap-8 items-start mb-12">
        <div className="flex-shrink-0 md:w-1/3">
            <img src={imageUrl} alt={title} className="w-full h-auto object-cover rounded-lg shadow-md" />
        </div>
        <div className="flex-grow">
            <h3 className="text-2xl font-bold text-pink-600 mb-2"><span className="text-gray-300 mr-2">{number}.</span>{title}</h3>
            <div className="text-gray-700 leading-relaxed space-y-2">
                {children}
            </div>
        </div>
    </div>
);


const TutorialView: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="bg-white p-6 md:p-12 rounded-lg shadow-xl max-w-5xl mx-auto">
      <header className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800">Your At-Home Brazilian Waxing Guide</h1>
        <p className="text-lg text-gray-600 mt-4">Welcome, {profile?.full_name?.split(' ')[0] || 'Glow Getter'}! Achieve salon-smooth results with confidence.</p>
      </header>

      {/* Section: Before You Begin */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-8">Part 1: Preparation is Everything</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-pink-50 p-6 rounded-lg border border-pink-100">
            <h3 className="text-xl font-semibold mb-4">What You'll Need</h3>
            <ul className="space-y-3">
              <li className="flex items-center"><span className="text-pink-500 mr-2">✓</span> Cera Brasileira Hard Wax Beads</li>
              <li className="flex items-center"><span className="text-pink-500 mr-2">✓</span> Professional Wax Warmer</li>
              <li className="flex items-center"><span className="text-pink-500 mr-2">✓</span> Applicator Sticks (various sizes)</li>
              <li className="flex items-center"><span className="text-pink-500 mr-2">✓</span> Pre-Wax Cleanser</li>
              <li className="flex items-center"><span className="text-pink-500 mr-2">✓</span> Post-Wax Soothing Oil</li>
              <li className="flex items-center"><span className="text-pink-500 mr-2">✓</span> A small hand mirror</li>
              <li className="flex items-center"><span className="text-pink-500 mr-2">✓</span> Clean towels</li>
            </ul>
          </div>
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h3 className="text-xl font-semibold mb-4">Skin & Hair Prep</h3>
            <p className="mb-2"><strong>Hair Length:</strong> Aim for about ¼ inch (6mm), like a grain of rice. Too short, and the wax won't grip. Too long, and it can be more painful. Trim if necessary.</p>
            <p className="mb-2"><strong>Exfoliate:</strong> Gently exfoliate the area 24-48 hours before waxing to remove dead skin cells.</p>
            <p><strong>Clean Skin:</strong> Right before you start, ensure your skin is clean, dry, and free of any lotions or oils.</p>
          </div>
        </div>
      </section>
      
      {/* Section: Step-by-Step */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold text-center mb-12">Part 2: The Step-by-Step Process</h2>
        
        <TutorialStep number="01" title="Melt the Wax" imageUrl="https://placehold.co/600x400/FFF0F5/DB2777?text=Melt+Wax">
          <p>Fill your warmer with Cera Brasileira Hard Wax Beads. Set it to a medium-high temperature until the wax is fully melted, then lower it to a medium-low heat to maintain the right consistency.</p>
          <p>The ideal texture is thick and honey-like, not runny or watery. It should drip slowly from your applicator stick.</p>
        </TutorialStep>
        
        <TutorialStep number="02" title="Patch Test" imageUrl="https://placehold.co/600x400/FFF0F5/DB2777?text=Patch+Test">
          <p>Safety first! Before applying to a sensitive area, test a small patch of wax on the inside of your wrist. It should feel warm, not uncomfortably hot.</p>
          <p>This ensures the temperature is safe and checks for any skin reactions.</p>
        </TutorialStep>
        
        <TutorialStep number="03" title="Cleanse & Prepare" imageUrl="https://placehold.co/600x400/FFF0F5/DB2777?text=Cleanse+Area">
          <p>Apply a small amount of Pre-Wax Cleanser to the entire area you plan to wax. This removes any bacteria or oils, ensuring the wax adheres properly to the hair.</p>
          <p>Pat the area completely dry with a clean towel.</p>
        </TutorialStep>

        <TutorialStep number="04" title="Apply the Wax" imageUrl="https://placehold.co/600x400/FFF0F5/DB2777?text=Apply+Wax">
          <p>Dip your applicator stick into the wax. Apply a moderately thick layer in the direction of hair growth. Work in small, manageable sections (about 2 inches wide and 3 inches long).</p>
          <p>At the end of your strip, create a thicker, rounded edge (a "lip"). This will be your handle for pulling.</p>
          <p><strong>Pro Tip:</strong> Use a mirror and try different positions (like propping one leg up on a stool) to get the best angle and visibility.</p>
        </TutorialStep>

        <TutorialStep number="05" title="Let it Set" imageUrl="https://placehold.co/600x400/FFF0F5/DB2777?text=Let+Wax+Set">
          <p>The wax needs to set for about 30-60 seconds. It's ready when it's no longer sticky to the touch and feels firm, like soft plastic.</p>
          <p>If you leave it on for too long, it can become brittle and break during removal.</p>
        </TutorialStep>
        
        <TutorialStep number="06" title="The Pull" imageUrl="https://placehold.co/600x400/FFF0F5/DB2777?text=The+Pull">
          <p>This is the moment of truth! Hold your skin taut with one hand. With the other hand, lift the "lip" you created.</p>
          <p>In one quick, confident motion, pull the wax strip off. <strong>Crucially, pull parallel to the skin</strong>, not upwards away from it. Think of pulling a command strip off a wall.</p>
          <p>Immediately after pulling, place your hand firmly on the area to apply pressure. This helps to instantly soothe the skin and reduce the stinging sensation.</p>
        </TutorialStep>

        <TutorialStep number="07" title="Repeat & Refine" imageUrl="https://placehold.co/600x400/FFF0F5/DB2777?text=Repeat">
          <p>Continue working in small sections until you've removed all desired hair. Don't re-wax the same spot more than twice in one session to avoid irritation.</p>
          <p>If a few stray hairs remain, it's best to remove them with tweezers.</p>
        </TutorialStep>
      </section>
      
      {/* Section: Aftercare */}
      <section className="mb-16 bg-gray-50 p-8 rounded-lg border border-gray-200">
        <h2 className="text-3xl font-bold text-center mb-8">Part 3: Post-Wax Aftercare</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-xl font-semibold mb-2">Immediate Care</h3>
            <p>Once you're done, apply our Post-Wax Soothing Oil. It will calm the skin, reduce redness, and gently remove any lingering wax residue.</p>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2">For the next 24-48 Hours...</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Avoid hot baths, saunas, and steam rooms.</li>
              <li>Wear loose, comfortable clothing (cotton is best).</li>
              <li>Avoid swimming pools and tanning.</li>
              <li>Refrain from heavy exercise that causes friction.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Section: FAQ */}
      <section>
        <h2 className="text-3xl font-bold text-center mb-8">Troubleshooting & FAQ</h2>
        <div className="max-w-3xl mx-auto">
          <AccordionItem title="What if the wax breaks when I pull it?">
            <p>This usually happens for one of two reasons: either the wax was applied too thinly, or it was left on the skin for too long and became brittle. Try applying a slightly thicker layer and removing it a little sooner. If a piece breaks off, you can apply a fresh, warm strip over it, let it set, and remove them together.</p>
          </AccordionItem>
          <AccordionItem title="My skin is red and bumpy. Is this normal?">
            <p>Yes, some temporary redness and minor bumps are completely normal, especially for your first few times. The skin is sensitive! This should subside within a few hours to a day. Applying our Post-Wax Soothing Oil will help calm the skin significantly. Avoid touching the area with unwashed hands.</p>
          </AccordionItem>
          <AccordionItem title="How do I prevent ingrown hairs?">
            <p>The best way to prevent ingrown hairs is regular, gentle exfoliation. Start exfoliating 2-3 days after your wax, and continue to do so 2-3 times per week. This helps keep the hair follicle clear so the new, softer hair can grow through easily.</p>
          </AccordionItem>
          <AccordionItem title="How often should I wax?">
            <p>Typically, every 3 to 6 weeks. This allows enough time for the hair to grow to the ideal length for your next session. You'll notice that with consistent waxing, the hair grows back finer and sparser over time!</p>
          </AccordionItem>
        </div>
      </section>
    </div>
  );
};

export default TutorialView;
