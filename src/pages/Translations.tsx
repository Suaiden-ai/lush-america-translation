import { useState } from 'react';
import { FileText, CurrencyDollar, Clock, Shield, CheckCircle, ArrowRight, Star, Globe, CaretDown, CaretUp, Envelope, Download, Upload, Eye, Lock } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { Chatbot } from '../components/Chatbot';
import { useI18n } from '../contexts/I18nContext';

export function Translations() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [activeFAQ, setActiveFAQ] = useState<number | null>(null);

  const faqs = [
    {
      question: t('faq.items.0.question', 'How long does translation take?'),
      answer: t('faq.items.0.answer', 'Standard translations are completed within 24-48 hours. Rush services are available for urgent documents (4-8 hours) at an additional fee.')
    },
    {
      question: t('faq.items.1.question', 'Are your translations accepted by USCIS?'),
      answer: t('faq.items.1.answer', 'Yes, all our translations are certified and authenticated, meeting USCIS requirements. They include official certification statements and are accepted by all US immigration authorities.')
    },
    {
      question: t('faq.items.2.question', 'What documents can you translate?'),
      answer: t('faq.items.2.answer', 'We translate all immigration documents including birth certificates, marriage certificates, academic transcripts, medical records, police clearances, and more. Contact us for specific document types.')
    },
    {
      question: t('faq.items.3.question', 'How do I verify my translation is authentic?'),
      answer: t('faq.items.3.answer', 'Each translation comes with a unique verification code. You can verify authenticity on our website or contact us directly with the code.')
    },
    {
      question: t('faq.items.4.question', 'Do you offer rush services?'),
      answer: t('faq.items.4.answer', 'Yes, we offer rush services for urgent documents. 4-8 hour turnaround is available for an additional 50% fee. Contact us for specific rush pricing.')
    },
         {
       question: t('faq.items.5.question', 'What languages do you support?'),
       answer: t('faq.items.5.answer', 'We support Portuguese, Portuguese (Portugal), Spanish, German, Arabic, Hebrew, Japanese, and Korean. All documents are translated to English for USCIS and US authority requirements.')
     }
  ];

  const testimonials = [
    {
      name: t('testimonials.items.0.name', 'David Thompson'),
      location: t('testimonials.items.0.location', 'Canada → New York'),
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
      text: t('testimonials.items.0.text', 'Fast and professional service. My birth certificate translation was accepted by USCIS without any issues.'),
      rating: 5,
      document: t('testimonials.items.0.document', 'Birth Certificate')
    },
    {
      name: t('testimonials.items.1.name', 'Jessica Martinez'),
      location: t('testimonials.items.1.location', 'Mexico → Texas'),
      image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
      text: t('testimonials.items.1.text', 'Excellent quality and quick turnaround. The verification system gave me peace of mind.'),
      rating: 5,
      document: t('testimonials.items.1.document', 'Academic Transcript')
    },
    {
      name: t('testimonials.items.2.name', 'Ryan Anderson'),
      location: t('testimonials.items.2.location', 'Brazil → California'),
      image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
      text: t('testimonials.items.2.text', 'Professional service with competitive pricing. My marriage certificate translation was perfect.'),
      rating: 5,
      document: t('testimonials.items.2.document', 'Marriage Certificate')
    }
  ];

    const stats = [
    { number: "99.9%", label: t('stats.uscisAcceptance', 'USCIS Acceptance') },
    { number: "24hrs", label: t('stats.avgTurnaround', 'Avg. Turnaround') },
    { number: "15K+", label: t('stats.documentsTranslated', 'Documents Translated') },
    { number: "8", label: t('stats.languagesSupported', 'Languages Supported'), icon: Globe }
  ];

  const pricingPlans = [
    {
      name: t('pricing.certifiedTranslation.name', 'Certified Translation'),
      price: "$20.00",
      period: t('pricing.perPage', 'per page'),
      description: t('pricing.certifiedTranslation.description', 'Official certified translation with legal authentication'),
      features: [
        t('pricing.certifiedTranslation.features.turnaround', '24-48 hour turnaround'),
        t('pricing.certifiedTranslation.features.notarization', 'Official notarization'),
        t('pricing.certifiedTranslation.features.authentication', 'Legal authentication'),
        t('pricing.certifiedTranslation.features.uscis', 'USCIS accepted'),
        t('pricing.certifiedTranslation.features.verification', 'Digital verification code'),
        t('pricing.certifiedTranslation.features.delivery', 'Email delivery'),
        t('pricing.certifiedTranslation.features.support', 'Priority support')
      ],
      popular: true
    },
    {
      name: t('pricing.bankStatements.name', 'Bank Statements'),
      price: "$25.00",
      period: t('pricing.perPage', 'per page'),
      description: t('pricing.bankStatements.description', 'Specialized translation for financial documents with enhanced verification'),
      features: [
        t('pricing.bankStatements.features.turnaround', '24-48 hour turnaround'),
        t('pricing.bankStatements.features.expertise', 'Financial document expertise'),
        t('pricing.bankStatements.features.verification', 'Enhanced verification process'),
        t('pricing.bankStatements.features.uscis', 'USCIS accepted'),
        t('pricing.bankStatements.features.digitalCode', 'Digital verification code'),
        t('pricing.bankStatements.features.delivery', 'Email delivery'),
        t('pricing.bankStatements.features.support', 'Priority support')
      ],
      popular: false
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 text-white py-20 overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-slate-900/30"></div>
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="absolute top-20 left-10 w-32 h-32 bg-red-600/10 rounded-full blur-3xl"></div>
            <div className="absolute top-40 right-20 w-48 h-48 bg-slate-600/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 left-20 w-40 h-40 bg-red-500/10 rounded-full blur-3xl"></div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white">
              {t('hero.title1', 'Professional')}
              <span className="text-red-500">
                {' '}{t('hero.title2', 'Document Translation')}
              </span>
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-slate-200 max-w-4xl mx-auto">
              {t('hero.description', 'Certified translation services for immigration documents with official authentication and verification. 99.9% USCIS acceptance rate.')}
            </p>

            {/* Stats Preview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="bg-white/15 backdrop-blur-sm rounded-xl p-6 border border-slate-400/20">
                  <div className="text-2xl font-bold text-white">{stat.number}</div>
                  <div className="text-sm text-slate-300">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate('/register')}
                className="bg-red-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-red-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2 shadow-xl"
              >
                <span>{t('hero.startTranslation', 'Start Translation')}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate('/verify')}
                className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white hover:text-slate-800 transition-all duration-300 transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <Eye className="w-5 h-5" />
                <span>{t('hero.verifyDocument', 'Verify Document')}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t('pricing.title', 'Simple, Transparent Pricing')}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('pricing.description', 'Professional translation services with competitive rates and guaranteed quality')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div key={index} className={`relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 ${
                plan.popular ? 'ring-2 ring-red-500 scale-105' : 'border border-gray-200'
              }`}>
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-red-600 text-white px-4 py-2 rounded-full text-sm font-semibold">
                    {t('pricing.mostPopular', 'Most Popular')}
                  </span>
                </div>
              )}
              
              <div className="text-center">
                <h3 className="text-2xl font-bold text-slate-800 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-slate-800">{plan.price}</span>
                  <span className="text-slate-600 ml-2">{plan.period}</span>
                </div>
                <p className="text-slate-600 mb-8">{plan.description}</p>
                
                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <span className="text-slate-700">{feature}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => navigate('/register')}
                  className={`w-full px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 ${
                    plan.popular
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                  }`}
                >
                  {plan.name === "Bank Statements" ? t('pricing.chooseBankStatements', 'Choose Bank Statements') : t('pricing.getStartedNow', 'Get Started Now')}
                </button>
              </div>
            </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-gray-600 text-sm mb-4">
              {t('pricing.note', '* Prices are per standard page (250 words). Complex documents may require additional fees.')}
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t('features.title', 'Why Choose Our Translation Services?')}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('features.description', 'Professional quality with guaranteed acceptance by US authorities')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-slate-100">
              <div className="w-16 h-16 bg-gradient-to-br from-slate-700 to-slate-800 rounded-2xl flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-white" weight="fill" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                {t('features.certified.title', 'Certified')}
              </h3>
              <p className="text-slate-600">
                {t('features.certified.description', 'All translations are certified by licensed professionals and authenticated with official seals and signatures. 99.9% USCIS acceptance rate.')}
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-slate-100">
              <div className="w-16 h-16 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl flex items-center justify-center mb-6">
                <Clock className="w-8 h-8 text-white" weight="fill" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                {t('features.fastTurnaround.title', 'Fast Turnaround')}
              </h3>
              <p className="text-slate-600">
                {t('features.fastTurnaround.description', 'Standard translations completed in 24-48 hours. Express service available for urgent documents (4-8 hours) with rush processing.')}
              </p>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-slate-100">
              <div className="w-16 h-16 bg-gradient-to-br from-slate-700 to-red-600 rounded-2xl flex items-center justify-center mb-6">
                <FileText className="w-8 h-8 text-white" weight="fill" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-4">
                {t('features.uscisCompliant.title', 'USCIS Compliant')}
              </h3>
              <p className="text-slate-600">
                {t('features.uscisCompliant.description', 'All translations meet USCIS requirements and are accepted by immigration offices, embassies, and consulates worldwide.')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t('howItWorks.title', 'How Our Translation Process Works')}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('howItWorks.description', 'Simple, secure, and professional document translation in 4 easy steps')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="w-20 h-20 bg-slate-800 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mb-6 mx-auto group-hover:scale-110 transition-transform">
                <Upload className="w-10 h-10" weight="fill" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">{t('howItWorks.steps.upload.title', 'Upload Document')}</h3>
              <p className="text-slate-600">
                {t('howItWorks.steps.upload.description', 'Upload your document securely to our platform. We support PDF, JPG, PNG, and other common formats.')}
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-red-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mb-6 mx-auto group-hover:scale-110 transition-transform">
                <CurrencyDollar className="w-10 h-10" weight="fill" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">{t('howItWorks.steps.quote.title', 'Get Quote')}</h3>
              <p className="text-slate-600">
                {t('howItWorks.steps.quote.description', 'Automatic calculation based on page count and document type. Transparent pricing with no hidden fees.')}
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-slate-800 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mb-6 mx-auto group-hover:scale-110 transition-transform">
                <Lock className="w-10 h-10" weight="fill" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">{t('howItWorks.steps.payment.title', 'Secure Payment')}</h3>
              <p className="text-slate-600">
                {t('howItWorks.steps.payment.description', 'Secure payment processing with instant confirmation. We accept all major credit cards and PayPal.')}
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-red-600 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mb-6 mx-auto group-hover:scale-110 transition-transform">
                <Download className="w-10 h-10" weight="fill" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-3">{t('howItWorks.steps.receive.title', 'Receive Translation')}</h3>
              <p className="text-slate-600">
                {t('howItWorks.steps.receive.description', 'Get your certified translation with verification code. Email delivery or physical copy available.')}
              </p>
            </div>
          </div>
        </div>
      </section>

             {/* Document Types Section */}
       <section className="py-20 bg-gray-50">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="text-center mb-16">
             <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
               {t('documentTypes.title', 'We Translate Everything')}
             </h2>
             <p className="text-xl text-gray-600 max-w-3xl mx-auto">
               {t('documentTypes.description', 'From personal documents to complex legal papers - we handle all types of translations')}
             </p>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {/* Common Documents */}
             <div className="bg-white p-8 rounded-2xl shadow-lg">
               <h3 className="text-xl font-semibold text-slate-800 mb-6 text-center">
                 {t('documentTypes.common.title', 'Most Common Documents')}
               </h3>
                               <div className="space-y-4">
                 <div className="flex items-center space-x-3">
                   <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                   <span className="text-slate-700">{t('documentTypes.common.birthCertificates', 'Birth Certificates')}</span>
                 </div>
                 <div className="flex items-center space-x-3">
                   <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                   <span className="text-slate-700">{t('documentTypes.common.marriageCertificates', 'Marriage Certificates')}</span>
                 </div>
                 <div className="flex items-center space-x-3">
                   <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                   <span className="text-slate-700">{t('documentTypes.common.academicTranscripts', 'Academic Transcripts')}</span>
                 </div>
                 <div className="flex items-center space-x-3">
                   <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                   <span className="text-slate-700">{t('documentTypes.common.bankStatements', 'Bank Statements')}</span>
                 </div>
                 <div className="flex items-center space-x-3">
                   <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                   <span className="text-slate-700">{t('documentTypes.common.medicalRecords', 'Medical Records')}</span>
                 </div>
                 <div className="flex items-center space-x-3">
                   <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                   <span className="text-slate-700">{t('documentTypes.common.legalDocuments', 'Legal Documents')}</span>
                 </div>
               </div>
             </div>

             {/* Everything Else */}
             <div className="bg-white p-8 rounded-2xl shadow-lg">
               <h3 className="text-xl font-semibold text-slate-800 mb-6 text-center">
                 {t('documentTypes.more.title', 'And Much More')}
               </h3>
               <div className="space-y-4">
                 <div className="flex items-center space-x-3">
                   <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                   <span className="text-slate-700">{t('documentTypes.more.anyOfficial', 'Any Official Document')}</span>
                 </div>
                 <div className="flex items-center space-x-3">
                   <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                   <span className="text-slate-700">{t('documentTypes.more.businessContracts', 'Business Contracts')}</span>
                 </div>
                 <div className="flex items-center space-x-3">
                   <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                   <span className="text-slate-700">{t('documentTypes.more.technicalManuals', 'Technical Manuals')}</span>
                 </div>
                 <div className="flex items-center space-x-3">
                   <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                   <span className="text-slate-700">{t('documentTypes.more.websiteContent', 'Website Content')}</span>
                 </div>
                                   <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-slate-700">{t('documentTypes.more.marketingMaterials', 'Marketing Materials')}</span>
                  </div>
               </div>
             </div>
           </div>

                       {/* Supported Languages */}
            <div className="mt-12">
              <div className="bg-white p-8 rounded-2xl shadow-lg">
                <h3 className="text-xl font-semibold text-slate-800 mb-6 text-center">
                  {t('languages.title', 'Supported Languages')}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-slate-700">{t('languages.portuguese', 'Portuguese')}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-slate-700">{t('languages.portuguesePortugal', 'Portuguese (Portugal)')}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-slate-700">{t('languages.spanish', 'Spanish')}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-slate-700">{t('languages.german', 'German')}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-slate-700">{t('languages.arabic', 'Arabic')}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-slate-700">{t('languages.hebrew', 'Hebrew')}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-slate-700">{t('languages.japanese', 'Japanese')}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-slate-700">{t('languages.korean', 'Korean')}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-4 text-center">
                  {t('languages.description', 'All documents are translated to English for USCIS and US authority requirements.')}
                </p>
              </div>
            </div>


         </div>
       </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t('testimonials.title', 'What Our Clients Say')}
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              {t('testimonials.description', 'Real feedback from satisfied clients who trusted us with their important documents')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-slate-50 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-slate-100">
                <div className="flex items-center mb-6">
                  <img 
                    src={testimonial.image} 
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-full object-cover mr-4"
                  />
                  <div>
                    <h4 className="font-semibold text-slate-800">{testimonial.name}</h4>
                    <p className="text-sm text-slate-600">{testimonial.location}</p>
                    <div className="flex items-center mt-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-slate-700 mb-4 italic">"{testimonial.text}"</p>
                <div className="inline-block bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                  {testimonial.document}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t('faq.title', 'Frequently Asked Questions')}
            </h2>
            <p className="text-xl text-gray-600">
              {t('faq.description', 'Everything you need to know about our translation services')}
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-100">
                <button
                  onClick={() => setActiveFAQ(activeFAQ === index ? null : index)}
                  className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-slate-800">{faq.question}</h3>
                  {activeFAQ === index ? (
                    <CaretUp className="w-6 h-6 text-slate-500" weight="fill" />
                  ) : (
                    <CaretDown className="w-6 h-6 text-slate-500" weight="fill" />
                  )}
                </button>
                {activeFAQ === index && (
                  <div className="px-8 pb-6">
                    <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Information Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              {t('contact.title', 'Need Help? Contact Us')}
            </h2>
            <p className="text-xl text-gray-600">
              {t('contact.description', 'Our translation experts are here to help you with any questions')}
            </p>
          </div>

          <div className="flex justify-center">
            <div className="bg-slate-50 p-8 rounded-2xl shadow-lg text-center border border-slate-100 max-w-sm w-full">
              <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Envelope className="w-8 h-8 text-red-600" weight="fill" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">{t('contact.email.title', 'Email')}</h3>
              <p className="text-slate-600">info@thefutureofenglish.com</p>
              <p className="text-sm text-slate-500 mt-2">{t('contact.email.support', '24/7 support')}</p>
            </div>
          </div>
        </div>
      </section>
      
      <Footer />
      <Chatbot />
    </div>
  );
}