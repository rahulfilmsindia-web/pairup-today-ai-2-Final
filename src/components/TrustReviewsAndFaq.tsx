import React, { useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Star, ShieldCheck, ChevronDown, ChevronUp, MessageSquare, Lock, HeartHandshake } from 'lucide-react';

interface FaqItem {
  q: { en: string; bn: string; hi: string };
  a: { en: string; bn: string; hi: string };
}

const FAQS: FaqItem[] = [
  {
    q: {
      en: 'How does 100% Government KYC Verification keep everyone safe?',
      bn: '১০০% সরকারি পরিচয়পত্র যাচাইকরণ (KYC) কীভাবে সবাইকে নিরাপদ রাখে?',
      hi: '100% सरकारी पहचान सत्यापन (KYC) सभी को कैसे सुरक्षित रखता है?'
    },
    a: {
      en: 'Every companion and client on PairUpToday must submit verified government identification (Aadhaar, PAN, Voter ID, or Passport) and bank account verification before accepting or requesting bookings. Real-time background screening and admin checks ensure complete trust.',
      bn: 'পেয়ারআপটুডে-তে প্রতিটি সঙ্গী ও ক্লায়েন্টকে বুকিং অনুরোধ বা গ্রহণের আগে তাদের সরকারি পরিচয়পত্র (আধার, প্যান, ভোটার কার্ড বা পাসপোর্ট) এবং ব্যাংক অ্যাকাউন্ট যাচাই সম্পন্ন করতে হয়। আমাদের প্রশাসনিক যাচাই সম্পূর্ণ বিশ্বাসযোগ্যতা নিশ্চিত করে।',
      hi: 'PairUpToday पर प्रत्येक साथी और ग्राहक को बुकिंग स्वीकार करने या अनुरोध करने से पहले अपने सरकारी पहचान पत्र (आधार, पैन, वोटर आईडी या पासपोर्ट) और बैंक खाते का सत्यापन पूरा करना अनिवार्य है।'
    }
  },
  {
    q: {
      en: 'How does the Start & Finish 4-Digit OTP Verification work?',
      bn: 'শুরু ও শেষের ৪-সংখ্যার ওটিপি (OTP) ভেরিফিকেশন কীভাবে কাজ করে?',
      hi: 'शुरुआत और समाप्ति का 4-अंकीय ओटीपी (OTP) सत्यापन कैसे काम करता है?'
    },
    a: {
      en: 'When meeting in person at the public venue, the client shares a confidential 4-digit Security OTP displayed on their live dashboard. The companion enters it into their portal to start the session timer. Upon verification, live tracking stops immediately to ensure complete privacy.',
      bn: 'পাবলিক ভেন্যুতে মুখোমুখি দেখা হওয়ার পর ক্লায়েন্ট তাদের লাইভ ড্যাশবোর্ডে প্রদর্শিত ৪-সংখ্যার গোপন সিকিউরিটি ওটিপি সঙ্গীকে জানান। সঙ্গী এটি প্রবেশ করালে সেশন টাইমার শুরু হয় এবং গোপনীয়তা রক্ষার্থে লাইভ ট্র্যাকিং সাথে সাথে বন্ধ হয়ে যায়।',
      hi: 'सार्वजनिक स्थान पर मिलने के बाद, ग्राहक अपने लाइव डैशबोर्ड पर प्रदर्शित 4-अंकीय सुरक्षा ओटीपी साथी को बताता है। साथी इसे अपने पोर्टल में दर्ज करके सत्र शुरू करता है, और गोपनीयता के लिए लाइव ट्रैकिंग तुरंत बंद हो जाती है।'
    }
  },
  {
    q: {
      en: 'How does 48-Hour Escrow Protection & Automated Refund Policy protect my funds?',
      bn: '৪৮-ঘণ্টার এসক্রো সুরক্ষা এবং স্বয়ংক্রিয় রিফান্ড পলিসি কীভাবে আমার টাকা সুরক্ষিত রাখে?',
      hi: '48-घंटे का एस्क्रो संरक्षण और स्वचालित रिफंड नीति मेरे पैसों की सुरक्षा कैसे करती है?'
    },
    a: {
      en: 'Your payment is held securely in a protected 48-hour escrow vault and is only released after the session concludes successfully. Cancelling more than 12 hours prior to the slot grants a 100% automatic refund. If a companion cancels, you receive a full 100% instant refund.',
      bn: 'আপনার পেমেন্ট একটি সুরক্ষিত ৪৮-ঘণ্টার এসক্রো ভল্টে জমা থাকে এবং সেশন সফলভাবে শেষ হওয়ার পরেই নিষ্পত্তি হয়। স্লটের ১২ ঘণ্টার বেশি আগে ক্যান্সেল করলে ১০০% স্বয়ংক্রিয় রিফান্ড পাবেন। সঙ্গী বাতিল করলে তৎক্ষণাৎ ১০০% রিফান্ড কার্যকর হয়।',
      hi: 'आपका भुगतान एक सुरक्षित 48-घंटे के एस्क्रो वॉलेट में सुरक्षित रहता है और सत्र सफलतापूर्वक संपन्न होने के बाद ही जारी किया जाता है। स्लॉट से 12 घंटे से अधिक पहले रद्द करने पर 100% स्वतः रिफंड मिलता है।'
    }
  },
  {
    q: {
      en: 'Is PairUpToday strictly platonic and safe?',
      bn: 'পেয়ারআপটুডে কি কঠোরভাবে অ-রোমান্টিক (Platonic) ও নিরাপদ?',
      hi: 'क्या PairUpToday पूरी तरह से गैर-रोमांटिक (Platonic) और सुरक्षित है?'
    },
    a: {
      en: 'Yes, 100%. PairUpToday is strictly a social, lifestyle, and platonic companionship platform for social gatherings, dining, city exploration, weddings, and events. Any solicitation of romantic, adult, or illegal activity results in immediate permanent ban and law enforcement reporting.',
      bn: 'হ্যাঁ, ১০০%। পেয়ারআপটুডে একটি খাঁটি সামাজিক ও লাইফস্টাইল সঙ্গ প্রদানকারী প্ল্যাটফর্ম। খাবার, ভ্রমণ, আড্ডা, অনুষ্ঠান বা উৎসবের জন্য এটি নিবেদিত। যেকোনো ধরনের অনৈতিক, রোমান্টিক বা প্রাপ্তবয়স্ক কার্যকলাপের প্রস্তাব দিলে সরাসরি স্থায়ী নিষেধাজ্ঞা ও আইনি ব্যবস্থা নেওয়া হয়।',
      hi: 'हाँ, 100%। PairUpToday पूरी तरह से सामाजिक, लाइफस्टाइल और प्लेटोनिक संगति का मंच है। बातचीत, खान-पान, शहर घूमने या पारिवारिक आयोजनों के लिए यह समर्पित है। किसी भी प्रकार की अनुचित मांग पर तत्काल आजीवन प्रतिबंध लगाया जाता है।'
    }
  }
];

export const TrustReviewsAndFaq: React.FC = () => {
  const { language } = useLanguage();
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const reviews = [
    {
      id: 1,
      name: language === 'bn' ? 'আরভ সেনগুপ্ত' : language === 'hi' ? 'आरव सेनगुप्ता' : 'Aarav Sengupta',
      city: language === 'bn' ? 'কলকাতা, পশ্চিমবঙ্গ' : language === 'hi' ? 'कोलकाता, पश्चिम बंगाल' : 'Kolkata, West Bengal',
      rating: 5.0,
      service: language === 'bn' ? 'ক্যাফে ও শহর দেখা' : language === 'hi' ? 'कैफे एवं शहर भ्रमण' : 'Cafe & City Tour',
      comment: language === 'bn'
        ? 'পার্ক স্ট্রিটে আর্ট এক্সিবিশন ও ক্যাফে ঘুরতে অনন্যা সেনকে বুক করেছিলাম। ওটিপি ভেরিফিকেশনের জন্য শুরু থেকেই নিরাপত্তা নিশ্চিত ছিল। দারুণ ভদ্র ও মার্জিত অভিজ্ঞতা!'
        : language === 'hi'
        ? 'पार्क स्ट्रीट पर कला प्रदर्शनी और कैफे घूमने के लिए अनन्या सेन को बुक किया था। ओटीपी सत्यापन से सुरक्षा पूरी तरह आश्वस्त थी। बहुत ही सभ्य और ज्ञानवर्धक अनुभव!'
        : 'Booked Ananya for an art exhibition and cafe visit at Park Street. The OTP verification made the meetup completely safe and seamless. Extremely polite, respectful, and well-spoken!'
    },
    {
      id: 2,
      name: language === 'bn' ? 'মীরা নায়ার' : language === 'hi' ? 'मीरा नायर' : 'Meera Nair',
      city: language === 'bn' ? 'বেঙ্গালুরু, কর্ণাটক' : language === 'hi' ? 'बेंगलुरु, कर्नाटक' : 'Bengaluru, Karnataka',
      rating: 5.0,
      service: language === 'bn' ? 'ডাইনিং ও সোশ্যাল' : language === 'hi' ? 'डाइनिंग एवं सोशल' : 'Dining & Social',
      comment: language === 'bn'
        ? 'অফিস কনফারেন্সে বেঙ্গালুরু এসে একা রেস্তোরাঁয় যাওয়ার জন্য সঙ্গী খুঁজেছিলাম। সম্পূর্ণ প্ল্যাটফর্ম ও এসক্রো সিস্টেম খুব নির্ভরযোগ্য ও নারী-বান্ধব।'
        : language === 'hi'
        ? 'ऑफिस सम्मेलन के लिए बेंगलुरु आई थी। शाम को शहर और रेस्तरां घूमने के लिए साथी चुना। पूरी प्रक्रिया बहुत सुरक्षित, पारदर्शी और महिलाओं के लिए सुरक्षित है।'
        : 'Traveled solo to Bengaluru for a corporate conference. Having a verified companion for evening dining gave me 100% peace of mind. Very safe and female-friendly platform!'
    },
    {
      id: 3,
      name: language === 'bn' ? 'বিক্রমাদিত্য রাও' : language === 'hi' ? 'विक्रमादित्य राव' : 'Vikramaditya Rao',
      city: language === 'bn' ? 'দিল্লি এনসিআর' : language === 'hi' ? 'दिल्ली एनसीआर' : 'Delhi NCR',
      rating: 4.9,
      service: language === 'bn' ? 'বিবাহ ও সামাজিক অনুষ্ঠান' : language === 'hi' ? 'विवाह एवं पारिवारिक कार्यक्रम' : 'Wedding & Family Event',
      comment: language === 'bn'
        ? 'দিল্লিতে একটি পারিবারিক বিয়েতে উপস্থিত থাকার জন্য একজন সহচর প্রয়োজন ছিল। পোশাক ও উপস্থাপনা ছিল অনবদ্য। ৪৮ ঘণ্টার এসক্রো সুরক্ষায় টাকা পুরোপুরি সুরক্ষিত ছিল।'
        : language === 'hi'
        ? 'दिल्ली में एक पारिवारिक विवाह समारोह में जाने के लिए साथी की जरूरत थी। रोहन का व्यवहार और शिष्टाचार उत्कृष्ट था। 48-घंटे की एस्क्रो सुरक्षा से भुगतान पूरी तरह सुरक्षित रहा।'
        : 'Needed a respectful companion to attend a family wedding reception in Delhi. Rohan was exceptionally well-groomed and courteous. The 48-hour escrow protection gave complete trust.'
    }
  ];

  return (
    <section className="py-16 sm:py-20 bg-slate-950 border-t border-slate-900 text-slate-100 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* 1. TESTIMONIALS SECTION */}
        <div>
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 text-xs font-bold mb-3">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>
                {language === 'bn' ? '১০,০০০+ যাচাইকৃত বুকিংয়ে ৪.৯/৫ রেটিং' : language === 'hi' ? '10,000+ सत्यापित बुकिंग पर 4.9/5 रेटिंग' : '4.9/5 Rating Across 10,000+ Verified Bookings'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
              {language === 'bn' ? 'ভারতজুড়ে গ্রাহকদের আস্থা ও অভিজ্ঞতা' : language === 'hi' ? 'पूरे भारत में ग्राहकों का विश्वास' : 'Trusted by Users Across India'}
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              {language === 'bn' 
                ? 'শতকরা ১০০ ভাগ সরকারি আইডি যাচাইকৃত সঙ্গী ও সুরক্ষিত এসক্রো পেমেন্ট ব্যবস্থার বাস্তব অভিজ্ঞতা।' 
                : language === 'hi'
                ? '100% सरकारी पहचान सत्यापित साथी और सुरक्षित एस्क्रो भुगतान का वास्तविक अनुभव।'
                : 'Real stories from verified clients enjoying safe, respectful, and platonic companionship.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.map(r => (
              <div
                key={r.id}
                className="p-6 rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-amber-400/40 transition-all duration-300 shadow-xl flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                      ))}
                      <span className="text-xs font-black text-slate-200 ml-1">{r.rating.toFixed(1)}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-pink-300 border border-slate-700 font-semibold">
                      {r.service}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed italic">
                    "{r.comment}"
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-400 to-pink-500 text-slate-950 font-black text-sm flex items-center justify-center shrink-0">
                    {r.name.slice(0, 1)}
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-100">{r.name}</h4>
                    <span className="text-[11px] text-slate-400 block">{r.city}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. FREQUENTLY ASKED QUESTIONS (FAQ) ACCORDION */}
        <div className="pt-4 max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-bold mb-2.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{language === 'bn' ? 'সাধারণ জিজ্ঞাসা ও নিরাপত্তা' : language === 'hi' ? 'सामान्य प्रश्न एवं सुरक्षा' : 'Safety & FAQ'}</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {language === 'bn' ? 'সচরাচর জিজ্ঞাসিত প্রশ্নাবলী (FAQ)' : language === 'hi' ? 'अक्सर पूछे जाने वाले सवाल (FAQ)' : 'Frequently Asked Questions (FAQ)'}
            </h3>
          </div>

          <div className="space-y-3.5">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              const question = faq.q[language] || faq.q.en;
              const answer = faq.a[language] || faq.a.en;

              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-slate-900 border border-slate-800/90 overflow-hidden transition-all duration-200"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 text-slate-100 hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <span className="text-xs sm:text-sm font-bold leading-relaxed">{question}</span>
                    <span className="p-1 rounded-lg bg-slate-800 text-slate-400 shrink-0">
                      {isOpen ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 animate-in fade-in duration-150">
                      <p className="mt-2 text-slate-400">{answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
};
