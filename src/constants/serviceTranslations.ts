import { Language } from '../types';
import { ServiceItem } from './services';

export interface LocalizedServiceText {
  name: string;
  description: string;
}

export const SERVICE_TRANSLATIONS: Record<Language, Record<number, LocalizedServiceText>> = {
  en: {
    1: {
      name: "Social & Conversation Companion",
      description: "Friendly companionship for conversations, casual chats, sharing stories and spending pleasant leisure time together."
    },
    2: {
      name: "Cafe & Restaurant Companion",
      description: "A companion for visiting cafés, restaurants, coffee shops and new food destinations and enjoying time together."
    },
    3: {
      name: "Movie & Cinema Companion",
      description: "Enjoy movies together at cinema halls, multiplexes and special movie screenings."
    },
    4: {
      name: "Shopping Companion",
      description: "Companionship for shopping malls, clothing stores, markets and other shopping activities, including general assistance in choosing items."
    },
    5: {
      name: "Travel & Holiday Companion",
      description: "Friendly companionship for domestic and international travel, holidays, tours and tourism trips."
    },
    6: {
      name: "City Tour & Sightseeing Companion",
      description: "Explore city attractions, popular spots, parks and new places with a companion."
    },
    7: {
      name: "Event & Exhibition Companion",
      description: "Companionship for exhibitions, fairs, book fairs, cultural programmes and public events."
    },
    8: {
      name: "Wedding & Ceremony Companion",
      description: "Companionship for weddings, receptions, family functions and social ceremonies."
    },
    9: {
      name: "Party & Clubbing Companion",
      description: "Companionship for social parties, special occasions and permitted entertainment events."
    },
    10: {
      name: "Concert & Live Music Companion",
      description: "Enjoy live music, concerts, band performances and music festivals together."
    },
    11: {
      name: "Sports & Stadium Companion",
      description: "Enjoy cricket, football and other sports at stadiums and sporting events with a companion."
    },
    12: {
      name: "Fitness & Walking Companion",
      description: "Companionship for walking, jogging, spending time in parks and general fitness activities."
    },
    13: {
      name: "Outdoor Activities Companion",
      description: "Companionship for picnics, park visits, spending time in nature and other outdoor activities."
    },
    14: {
      name: "Hobby & Creative Activities Companion",
      description: "Spend time together on painting, photography, handicrafts and other creative hobbies."
    },
    15: {
      name: "Gaming & Indoor Activities Companion",
      description: "Enjoy chess, board games, card games and other indoor recreational activities together."
    },
    16: {
      name: "Study & Co-working Companion",
      description: "Spend time studying or working together in libraries, study spaces and co-working environments."
    },
    17: {
      name: "Senior Citizen Companionship",
      description: "Friendly companionship for senior citizens through conversations, casual chats, walking and social activities."
    },
    18: {
      name: "Hospital & Medical Appointment Companion",
      description: "Companionship during travel to hospitals, clinics or medical appointments and while waiting. This is not a medical service."
    },
    19: {
      name: "Daily Errands & Market Companion",
      description: "Companionship for markets, post offices, banks, shopping and other ordinary daily errands."
    },
    20: {
      name: "Religious & Spiritual Visit Companion",
      description: "Companionship for visits to temples, mosques, churches, gurudwaras and other religious or spiritual places."
    },
    21: {
      name: "Airport & Railway Travel Companion",
      description: "Companionship and general assistance before or after journeys at airports and railway stations."
    },
    22: {
      name: "Local Exploration & Food Discovery Companion",
      description: "Discover local food, street food, popular markets and new places around the city with a companion."
    },
    23: {
      name: "Tourist Guide & Local Exploration Companion",
      description: "Explore historical places, heritage sites, tourist attractions, local culture and tourism destinations with a companion. Professional guiding must be performed only where the required qualifications and permissions are available."
    },
    24: {
      name: "Elder Care & Daily Living Assistance Companion",
      description: "Companionship for elderly individuals in everyday life, including walking, general assistance, meal reminders, shopping, social activities and accompanying them to necessary appointments."
    }
  },
  bn: {
    1: {
      name: "সামাজিক ও কথোপকথন সঙ্গী",
      description: "মনখোলা গল্পগুজব, ব্যক্তিগত ভাবনা বিনিময় এবং চমৎকার অবসর সময় কাটানোর জন্য আন্তরিক সাহচর্য।"
    },
    2: {
      name: "ক্যাফে ও রেস্তোরাঁ সঙ্গী",
      description: "রেস্তোরাঁ, কফি শপ কিংবা শহরের নতুন খাবারের স্বাদ একসাথে উপভোগ করার জন্য সঙ্গী।"
    },
    3: {
      name: "সিনেমা ও থিয়েটার সঙ্গী",
      description: "সিনেমা হল, মাল্টিপ্লেক্স বা বিশেষ চলচ্চিত্র প্রদর্শনীতে একসাথে সিনেমা দেখার আনন্দ।"
    },
    4: {
      name: "শপিং ও কেনাকাটার সঙ্গী",
      description: "শপিং মল, কাপড়ের দোকান বা বাজারে কেনাকাটার সময় পছন্দ ও সহযোগিতার জন্য সঙ্গী।"
    },
    5: {
      name: "ভ্রমণ ও অবকাশ সঙ্গী",
      description: "দেশ ও বিদেশের বিভিন্ন পর্যটন স্থানে অবকাশ যাপন এবং নিরাপদ ভ্রমণের চমৎকার অভিজ্ঞতা।"
    },
    6: {
      name: "শহর ভ্রমণ ও দর্শনীয় স্থান সঙ্গী",
      description: "শহরের ঐতিহাসিক স্থান, উদ্যান এবং দর্শনীয় স্থানসমূহ একসাথে ঘুরে দেখার জন্য সঙ্গী।"
    },
    7: {
      name: "মেলা ও প্রদর্শনী সঙ্গী",
      description: "বইমেলা, শিল্প প্রদর্শনী, বাণিজ্য মেলা ও সাংস্কৃতিক অনুষ্ঠানে যোগ দেওয়ার বিশ্বস্ত সঙ্গী।"
    },
    8: {
      name: "বিবাহ ও সামাজিক অনুষ্ঠান সঙ্গী",
      description: "বিয়েবাড়ি, অভ্যর্থনা, পারিবারিক অনুষ্ঠান ও সামাজিক উৎসবে সাথে থাকার নির্ভরযোগ্য সাহচর্য।"
    },
    9: {
      name: "পার্টি ও সান্ধ্যকালীন সঙ্গী",
      description: "বৈধ ও মার্জিত সামাজিক পার্টি, বিশেষ উপলক্ষ এবং আনন্দময় আড্ডার চমৎকার সঙ্গী।"
    },
    10: {
      name: "সঙ্গীতানুষ্ঠান ও কনসার্ট সঙ্গী",
      description: "লাইভ মিউজিক কনসার্ট, ব্যান্ড পারফরম্যান্স ও সঙ্গীত উৎসবে একসাথে মেতে ওঠার আনন্দ।"
    },
    11: {
      name: "খেলাধুলা ও স্টেডিয়াম সঙ্গী",
      description: "ক্রিকেট বা ফুটবল স্টেডিয়ামে বসে প্রিয় দলের খেলা সরাসরি উপভোগ করার সঙ্গী।"
    },
    12: {
      name: "হাঁটা ও ফিটনেস সঙ্গী",
      description: "সকালে বা বিকেলে পার্কে হাঁটা, জগিং এবং সাধারণ ফিটনেস কার্যক্রমে উৎসাহ দেওয়ার সঙ্গী।"
    },
    13: {
      name: "আউটডোর ও প্রকৃতি সঙ্গী",
      description: "পিকনিক, পার্কে ভ্রমণ, প্রাকৃতিক সৌন্দর্য উপভোগ এবং উন্মুক্ত পরিবেশে সময় কাটানো।"
    },
    14: {
      name: "শখ ও সৃজনশীল কার্যক্রম সঙ্গী",
      description: "চিত্রাঙ্কন, ফটোগ্রাফি, হস্তশিল্প এবং বিভিন্ন সৃজনশীল শখের চর্চায় সঙ্গী হওয়া।"
    },
    15: {
      name: "ইনডোর গেমস ও বিনোদন সঙ্গী",
      description: "দাবা, বোর্ড গেম, ক্যারাম এবং বিভিন্ন ইনডোর খেলাধুলার আনন্দ ভাগ করে নেওয়ার সঙ্গী।"
    },
    16: {
      name: "পড়াশোনা ও কো-ওয়ার্কিং সঙ্গী",
      description: "লাইব্রেরি, কো-ওয়ার্কিং স্পেস বা স্টাডি জোনে একসাথে একাগ্রচিত্তে অধ্যয়ন ও কাজ করা।"
    },
    17: {
      name: "বয়োজ্যেষ্ঠদের সাহচর্য",
      description: "প্রবীণ নাগরিকদের সাথে সম্মানজনক কথোপকথন, গল্প বলা ও সান্ধ্যকালীন হাঁটার আন্তরিক সাহচর্য।"
    },
    18: {
      name: "হাসপাতাল ও ডাক্তার অ্যাপয়েন্টমেন্ট সঙ্গী",
      description: "চিকিৎসকের কাছে যাওয়ার সময় সঙ্গে থাকা এবং অপেক্ষার সময় পাশে থাকা (এটি কোনো চিকিৎসা সেবা নয়)।"
    },
    19: {
      name: "দৈনন্দিন বাজার ও প্রয়োজনীয় কাজের সঙ্গী",
      description: "বাজারঘাট, ব্যাংক, পোস্ট অফিস বা অন্যান্য জরুরি দৈনন্দিন কাজে বিশ্বস্ত সঙ্গী হিসেবে সহায়তা।"
    },
    20: {
      name: "ধর্মীয় ও আধ্যাত্মিক স্থান দর্শন সঙ্গী",
      description: "মন্দির, মসজিদ, গির্জা বা যেকোনো পবিত্র আধ্যাত্মিক স্থানে শ্রদ্ধাপূর্ণ ভ্রমণের সঙ্গী।"
    },
    21: {
      name: "বিমানবন্দর ও রেলস্টেশন যাত্রা সঙ্গী",
      description: "বিমানবন্দর বা রেলস্টেশনে পৌঁছানো, লাগেজ ব্যবস্থাপনা ও যাত্রার পূর্বে সাধারণ সহায়তা।"
    },
    22: {
      name: "স্থানীয় খাবার ও স্ট্রিট ফুড অন্বেষণ সঙ্গী",
      description: "শহরের বিখ্যাত স্ট্রিট ফুড ও ঐতিহ্যবাহী স্থানীয় খাবারের স্বাদ একসাথে উপভোগ করা।"
    },
    23: {
      name: "ট্যুরিস্ট গাইড ও স্থানীয় সংস্কৃতি সঙ্গী",
      description: "ঐতিহাসিক সৌধ ও স্থানীয় সংস্কৃতির সাথে পরিচিত হওয়া (যোগ্যতা ও অনুমতি সাপেক্ষে)।"
    },
    24: {
      name: "প্রবীণ পরিচর্যা ও জীবনযাত্রা সহায়তা সঙ্গী",
      description: "বয়োজ্যেষ্ঠদের প্রতিদিনের ওষুধ মনে করানো, গল্প করা এবং যত্নশীল সাহচর্য প্রদান করা।"
    }
  },
  hi: {
    1: {
      name: "सामाजिक एवं बातचीत साथी",
      description: "आत्मीय चर्चा, विचार साझा करने और सुखद समय बिताने के लिए संवेदनशील एवं मैत्रीपूर्ण साहचर्य।"
    },
    2: {
      name: "कैफ़े एवं रेस्तरां साथी",
      description: "कैफ़े, रेस्तरां या शहर के नए स्वादिष्ट व्यंजनों का आनंद एक साथ लेने के लिए साथी।"
    },
    3: {
      name: "सिनेमा एवं फ़िल्म साथी",
      description: "सिनेमा हॉल, मल्टीप्लेक्स या फ़िल्म स्क्रीनिंग में साथ बैठकर फ़िल्में देखने का आनंद।"
    },
    4: {
      name: "शॉपिंग एवं ख़रीदारी साथी",
      description: "शॉपिंग मॉल, बाज़ारों में ख़रीदारी और वस्त्र चयन में मैत्रीपूर्ण सहयोग हेतु संगति।"
    },
    5: {
      name: "यात्रा एवं अवकाश साथी",
      description: "देश और विदेश के पर्यटन स्थलों पर छुट्टियों और आरामदायक यात्रा का सुखद अनुभव।"
    },
    6: {
      name: "नगर दर्शन एवं दर्शनीय स्थल साथी",
      description: "शहर के आकर्षणों, पार्कों और ऐतिहासिक स्थानों को एक साथ घूमने का अनुभव।"
    },
    7: {
      name: "प्रदर्शनी एवं समारोह साथी",
      description: "पुस्तक मेलों, कला प्रदर्शनियों, व्यापार मेलों और सांस्कृतिक कार्यक्रमों में सहभागिता।"
    },
    8: {
      name: "विवाह एवं पारिवारिक उत्सव साथी",
      description: "विवाह समारोह, स्वागत उत्सव और पारिवारिक कार्यक्रमों में शालीन साहचर्य।"
    },
    9: {
      name: "पार्टी एवं उत्सव साथी",
      description: "स्वीकृत सामाजिक आयोजनों, उत्सवों और विशेष अवसरों पर आनंदमय संगति।"
    },
    10: {
      name: "संगीत एवं कॉन्सर्ट साथी",
      description: "लाइव म्यूज़िक कॉन्सर्ट, बैंड प्रस्तुतियों और संगीत सम्मेलनों का एक साथ आनंद लें।"
    },
    11: {
      name: "खेलकूद एवं स्टेडियम साथी",
      description: "क्रिकेट, फुटबॉल स्टेडियम में बैठकर मैचों का सीधा रोमांच एक साथ साझा करें।"
    },
    12: {
      name: "फ़िटनेस एवं प्रातःभ्रमण साथी",
      description: "पार्क में टहलने, जॉगिंग और सामान्य स्वास्थ्य गतिविधियों में प्रेरक संगति।"
    },
    13: {
      name: "आउटडोर एवं प्रकृति साथी",
      description: "पिकनिक, प्राकृतिक भ्रमण और खुले वातावरण में सुखद समय व्यतीत करने का अवसर।"
    },
    14: {
      name: "सृजनात्मक रुचि एवं कला साथी",
      description: "चित्रकारी, फ़ोटोग्राफ़ी, हस्तशिल्प और रचनात्मक हॉबीज को एक साथ आगे बढ़ाएँ।"
    },
    15: {
      name: "इंडोर गेम्स एवं मनोरंजन साथी",
      description: "शतरंज, बोर्ड गेम्स, कैरम और इनडोर खेलों का मानसिक मनोरंजन साझा करें।"
    },
    16: {
      name: "अध्ययन एवं को-वर्किंग साथी",
      description: "पुस्तकालय या को-वर्किंग स्पेस में एकाग्रता के साथ अध्ययन या कार्य में साथ बैठना।"
    },
    17: {
      name: "वरिष्ठ नागरिक साहचर्य",
      description: "बुजुर्गों के साथ सम्मानजनक चर्चा, अनुभव सुनना और दैनिक दिनचर्या में स्नेहपूर्ण साहचर्य।"
    },
    18: {
      name: "चिकित्सालय एवं डॉक्टर मुलाक़ात साथी",
      description: "अस्पताल जाने और प्रतीक्षालय में बैठने के दौरान सहायता (यह कोई चिकित्सीय सेवा नहीं है)।"
    },
    19: {
      name: "दैनिक कार्य एवं बाज़ार साथी",
      description: "बाज़ार, बैंक, डाकघर या अन्य रोज़मर्रा के कार्यों में सहयोगी के रूप में साथ चलना।"
    },
    20: {
      name: "धार्मिक एवं आध्यात्मिक यात्रा साथी",
      description: "मंदिर, मस्जिद, गुरुद्वारे या अन्य पवित्र स्थलों के दर्शन में श्रद्धापूर्ण संगति।"
    },
    21: {
      name: "हवाई अड्डा एवं रेलवे यात्रा साथी",
      description: "यात्रा से पहले या बाद में स्टेशन अथवा एयरपोर्ट पर सामान्य सहायता और संगति।"
    },
    22: {
      name: "स्थानीय व्यंजन एवं स्ट्रीट फ़ूड साथी",
      description: "शहर के लोकप्रिय खान-पान, स्ट्रीट फ़ूड और प्रसिद्ध व्यंजनों की संयुक्त खोज।"
    },
    23: {
      name: "पर्यटन मार्गदर्शक एवं सांस्कृतिक साथी",
      description: "ऐतिहासिक धरोहरों व संस्कृति को समझना (वैध अनुमति व योग्यता के अधीन)।"
    },
    24: {
      name: "बुजुर्गों की देखभाल व जीवन सहयोग साथी",
      description: "दवाइयाँ याद दिलाना, टहलाना और बुजुर्गों के दैनिक जीवन में सम्मानजनक उपस्थिति।"
    }
  }
};

export function getLocalizedService(service: ServiceItem, lang: Language): ServiceItem {
  const trans = SERVICE_TRANSLATIONS[lang]?.[service.id] || SERVICE_TRANSLATIONS.en[service.id];
  if (!trans) return service;
  return {
    ...service,
    name: trans.name,
    description: trans.description
  };
}
