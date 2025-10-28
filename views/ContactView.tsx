import React, { useState } from 'react';
import { supabaseService } from '../services/supabaseService';
import Spinner from '../components/Spinner';
import type { ContactFormData } from '../types';

const WhatsAppIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.487 5.235 3.487 8.413 0 6.557-5.338 11.892-11.894 11.892-1.99 0-3.903-.52-5.613-1.476l-6.238 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.451-4.437-9.885-9.888-9.885-5.451 0-9.885 4.434-9.888 9.885.001 2.245.75 4.385 2.106 6.057l-1.35 4.939 5.025-1.332zM12 4.012c4.873 0 8.847 3.972 8.847 8.846s-3.974 8.846-8.847 8.846-8.847-3.972-8.847-8.846c0-2.384.954-4.606 2.65-6.223l-1.09-3.967 4.09 1.082c1.554-.959 3.28-1.503 5.107-1.503zm0 1.258c-4.14 0-7.5 3.36-7.5 7.5s3.36 7.5 7.5 7.5 7.5-3.36 7.5-7.5-3.36-7.5-7.5-7.5zm.366 3.159a.37.37 0 00-.366.366v5.242a.37.37 0 00.366.366h2.955a.37.37 0 00.366-.366V12.5a.37.37 0 00-.366-.366h-2.955zm-1.898-1.48a.37.37 0 00-.366.366v1.48h-1.48a.37.37 0 00-.366.366v1.48a.37.37 0 00.366.366h1.48v1.48a.37.37 0 00.366.366h1.48a.37.37 0 00.366-.366v-1.48h1.48a.37.37 0 00.366-.366v-1.48a.37.37 0 00-.366-.366h-1.48v-1.48a.37.37 0 00-.366-.366h-1.48z" />
  </svg>
);

const EmailIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
);


const ContactView: React.FC = () => {
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const whatsappNumber = "6281288472398"; // The number without '+' or spaces
  const officialEmail = "info@cerabrasileira.com";

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await supabaseService.sendContactMessage(formData);
      setSuccessMessage("Thank you for your message! We'll get back to you shortly.");
      setFormData({ name: '', email: '', subject: '', message: '' }); // Clear form on success
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-lg shadow-xl max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold">Get In Touch</h1>
        <p className="text-gray-600 mt-2">Have a question or feedback? We'd love to hear from you!</p>
      </div>

      <div className="flex flex-col md:flex-row justify-center items-center gap-8 my-8 text-center border-y py-6">
        <a href={`mailto:${officialEmail}`} className="group flex items-center text-gray-700 hover:text-pink-600 transition-colors">
            <EmailIcon />
            <span className="font-semibold">{officialEmail}</span>
        </a>
         <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="group flex items-center text-gray-700 hover:text-green-600 transition-colors">
            <WhatsAppIcon />
            <span className="font-semibold">Chat on WhatsApp</span>
        </a>
      </div>


      {successMessage && (
        <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded-md mb-6" role="alert">
          <p className="font-bold">Success</p>
          <p>{successMessage}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-md mb-6" role="alert">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      )}

      <p className="text-center text-gray-500 mb-6">Or send us a message using the form below:</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
            <input
              type="text"
              name="name"
              id="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="mt-1 p-3 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
            <input
              type="email"
              name="email"
              id="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="mt-1 p-3 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
            />
          </div>
        </div>
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-700">Subject</label>
          <input
            type="text"
            name="subject"
            id="subject"
            value={formData.subject}
            onChange={handleInputChange}
            required
            className="mt-1 p-3 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
          />
        </div>
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700">Message</label>
          <textarea
            name="message"
            id="message"
            rows={5}
            value={formData.message}
            onChange={handleInputChange}
            required
            className="mt-1 p-3 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-pink-500 focus:border-pink-500"
          />
        </div>
        <div className="flex justify-end items-center">
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex justify-center py-3 px-8 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-pink-500 hover:bg-pink-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:bg-pink-300"
          >
            {isLoading ? <Spinner /> : 'Send Message'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ContactView;