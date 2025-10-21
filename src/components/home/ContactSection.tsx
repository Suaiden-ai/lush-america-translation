import React from 'react';
import { ChatCircle, Envelope, Phone, WhatsappLogo } from '@phosphor-icons/react';

export function ContactSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Get in Touch
          </h2>
          <p className="text-xl text-gray-600">
            Ready to start your journey? Contact us today!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div 
            className="bg-gray-50 p-8 rounded-2xl shadow-lg text-center cursor-pointer hover:bg-gray-100 transition-all duration-300"
            onClick={() => window.location.href = 'tel:+13237883117'}
          >
            <div className="w-16 h-16 bg-tfe-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Phone className="w-8 h-8 text-tfe-blue-600" weight="fill" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Phone</h3>
            <p className="text-gray-600">(000) 000-0000</p>
            <p className="text-sm text-gray-500 mt-2">Mon-Fri: 9AM-6PM EST</p>
          </div>
          
          <div className="bg-gray-50 p-8 rounded-2xl shadow-lg text-center">
            <div className="w-16 h-16 bg-tfe-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Envelope className="w-8 h-8 text-tfe-red-600" weight="fill" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Email</h3>
            <p className="text-gray-600">info@thefutureofenglish.com</p>
            <p className="text-sm text-gray-500 mt-2">24/7 support</p>
          </div>
          
          <div 
            className="bg-gray-50 p-8 rounded-2xl shadow-lg text-center cursor-pointer hover:bg-gray-100 transition-all duration-300"
            onClick={() => window.open('https://wa.me/13237883117?text=Hello%20The%20Future%20of%20English,%20I%20would%20like%20to%20know%20more%20about%20the%20visa%20consulting%20service.', '_blank')}
          >
            <div className="w-16 h-16 bg-gradient-to-br from-tfe-blue-100 to-tfe-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <WhatsappLogo className="w-8 h-8 text-tfe-blue-600" weight="fill" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">WhatsApp</h3>
            <p className="text-gray-600">(000) 000-0000</p>
            <p className="text-sm text-gray-500 mt-2">Instant messaging</p>
          </div>
        </div>
      </div>
    </section>
  );
} 