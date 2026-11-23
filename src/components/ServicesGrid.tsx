import React, { useState } from 'react';
import { PAIRUP_SERVICES, ServiceItem, ServiceCategory } from '../constants/services';
import { useLanguage } from '../context/LanguageContext';
import { 
  MessageCircleHeart, Coffee, Film, ShoppingBag, Plane, Compass, 
  Calendar, Sparkles, PartyPopper, Music, Trophy, Activity, 
  Trees, Palette, Gamepad2, BookOpen, HeartHandshake, Building2, 
  CheckSquare, Sun, TrainTrack, Utensils, MapPin, ShieldCheck,
  Car, Camera, Video, Megaphone, Mic, Moon, Footprints,
  GraduationCap, Baby, ChefHat, ShieldAlert,
  ArrowRight, ChevronDown, ChevronUp, Layers
} from 'lucide-react';

interface ServicesGridProps {
  onSelectService: (service: ServiceItem) => void;
}

// Icon mapper for all 36 services
const getIcon = (iconName: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    MessageCircleHeart: <MessageCircleHeart className="w-5 h-5 text-pink-400" />,
    Coffee: <Coffee className="w-5 h-5 text-amber-400" />,
    Film: <Film className="w-5 h-5 text-rose-400" />,
    ShoppingBag: <ShoppingBag className="w-5 h-5 text-sky-400" />,
    Plane: <Plane className="w-5 h-5 text-blue-400" />,
    Compass: <Compass className="w-5 h-5 text-teal-400" />,
    Calendar: <Calendar className="w-5 h-5 text-indigo-400" />,
    Sparkles: <Sparkles className="w-5 h-5 text-amber-300" />,
    PartyPopper: <PartyPopper className="w-5 h-5 text-pink-500" />,
    Music: <Music className="w-5 h-5 text-purple-400" />,
    Trophy: <Trophy className="w-5 h-5 text-yellow-400" />,
    Activity: <Activity className="w-5 h-5 text-emerald-400" />,
    Trees: <Trees className="w-5 h-5 text-green-400" />,
    Palette: <Palette className="w-5 h-5 text-orange-400" />,
    Gamepad2: <Gamepad2 className="w-5 h-5 text-violet-400" />,
    BookOpen: <BookOpen className="w-5 h-5 text-cyan-400" />,
    HeartHandshake: <HeartHandshake className="w-5 h-5 text-red-400" />,
    Building2: <Building2 className="w-5 h-5 text-sky-300" />,
    CheckSquare: <CheckSquare className="w-5 h-5 text-emerald-300" />,
    Sun: <Sun className="w-5 h-5 text-amber-400" />,
    TrainTrack: <TrainTrack className="w-5 h-5 text-slate-300" />,
    Utensils: <Utensils className="w-5 h-5 text-orange-400" />,
    MapPin: <MapPin className="w-5 h-5 text-rose-500" />,
    ShieldCheck: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
    Car: <Car className="w-5 h-5 text-sky-400" />,
    Camera: <Camera className="w-5 h-5 text-pink-400" />,
    Video: <Video className="w-5 h-5 text-purple-400" />,
    Megaphone: <Megaphone className="w-5 h-5 text-amber-400" />,
    Mic: <Mic className="w-5 h-5 text-rose-400" />,
    Moon: <Moon className="w-5 h-5 text-indigo-400" />,
    Footprints: <Footprints className="w-5 h-5 text-emerald-400" />,
    GraduationCap: <GraduationCap className="w-5 h-5 text-blue-400" />,
    Baby: <Baby className="w-5 h-5 text-pink-300" />,
    ChefHat: <ChefHat className="w-5 h-5 text-amber-500" />,
    ShieldAlert: <ShieldAlert className="w-5 h-5 text-red-400" />
  };
  return iconMap[iconName] || <Sparkles className="w-5 h-5 text-amber-400" />;
};

export const ServicesGrid: React.FC<ServicesGridProps> = ({ onSelectService }) => {
  const [activeCategory, setActiveCategory] = useState<'all' | ServiceCategory>('all');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const { language } = useLanguage();

  const categoryLabels: Record<'all' | ServiceCategory, { en: string; bn: string; hi: string }> = {
    all: { en: 'All (36)', bn: 'সব (৩৬)', hi: 'सभी (36)' },
    social: { en: 'Social & Entertainment', bn: 'সামাজিক ও বিনোদন', hi: 'सामाजिक एवं मनोरंजन' },
    travel: { en: 'Travel & Exploration', bn: 'ভ্রমণ ও শহর দেখা', hi: 'यात्रा एवं पर्यटन' },
    creator: { en: 'Creator & Lifestyle', bn: 'কনটেন্ট ও লাইফস্টাইল', hi: 'क्रिएटर व लाइफस्टाइल' },
    active: { en: 'Active & Hobbies', bn: 'খেলাধুলা ও শখ', hi: 'खेलकूद एवं हॉबी' },
    care: { en: 'Care & Family', bn: 'পরিচর্যা ও সহায়তা', hi: 'देखभाल एवं परिवार' }
  };

  const categories: Array<{ id: 'all' | ServiceCategory; label: string }> = [
    { id: 'all', label: categoryLabels.all[language] || categoryLabels.all.en },
    { id: 'social', label: categoryLabels.social[language] || categoryLabels.social.en },
    { id: 'travel', label: categoryLabels.travel[language] || categoryLabels.travel.en },
    { id: 'creator', label: categoryLabels.creator[language] || categoryLabels.creator.en },
    { id: 'active', label: categoryLabels.active[language] || categoryLabels.active.en },
    { id: 'care', label: categoryLabels.care[language] || categoryLabels.care.en }
  ];

  const filteredServices = activeCategory === 'all'
    ? PAIRUP_SERVICES
    : PAIRUP_SERVICES.filter(s => s.category === activeCategory);

  // Top 8 services by default to prevent long scrolling; expandable to all
  const displayedServices = isExpanded ? filteredServices : filteredServices.slice(0, 8);
  const hasMore = filteredServices.length > 8;

  return (
    <section id="services-section" className="py-16 sm:py-20 bg-slate-950 text-slate-100 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs uppercase font-extrabold tracking-wider text-amber-400 mb-2.5 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/20">
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {language === 'bn' ? '৩৬টি যাচাইকৃত পরিষেবা' : language === 'hi' ? '36 सत्यापित सेवाएं' : '36 Verified Companion Services'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-100 tracking-tight">
              {language === 'bn' ? 'আপনার পছন্দের সাহচর্য বেছে নিন' : language === 'hi' ? 'अपनी पसंद का साथी चुनें' : 'Find Companionship for Every Occasion'}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              {language === 'bn' 
                ? 'আড্ডা, ডাইনিং, ব্যক্তিগত ড্রাইভার, ফটোগ্রাফি থেকে শুরু করে প্রবীণ যত্ন — ১০০% নিরাপদ ও যাচাইকৃত সঙ্গীর সাথে কাটান আনন্দময় সময়।' 
                : language === 'hi'
                ? 'बातचीत, डाइनिंग, पर्सनल ड्राइवर, फोटोशूट से लेकर बुजुर्गों की देखभाल तक — 100% सुरक्षित और सत्यापित साथी।'
                : 'From casual hangouts, dining, and personal drivers to content creation and elder care — strictly platonic, KYC-verified companions across India.'}
            </p>
          </div>

          {/* Clean 5-Category Horizontal Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl overflow-x-auto max-w-full scrollbar-none shadow-inner">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  // Keep preview bounded when switching categories
                }}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all duration-200 cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 shadow-md shadow-pink-500/20 scale-[1.02]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* 8 Default Popular Services Grid (Expandable to 36) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {displayedServices.map(service => (
            <div
              key={service.id}
              onClick={() => onSelectService(service)}
              className="group cursor-pointer rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-pink-500/50 overflow-hidden shadow-lg shadow-black/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-pink-500/15 flex flex-col justify-between"
            >
              <div>
                {/* Card Visual Header with Verified Service Image */}
                <div className="relative h-56 sm:h-60 w-full overflow-hidden bg-slate-950">
                  <img
                    src={service.image}
                    alt={service.cardTitle}
                    className="w-full h-full object-cover object-[center_12%] transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                  
                  {/* Category Chip Tag */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-950/85 backdrop-blur-md border border-slate-800 text-[11px] font-bold text-amber-300 shadow-md">
                    {service.chipLabel}
                  </div>

                  {/* Service Icon */}
                  <div className="absolute bottom-3 left-3 p-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-lg group-hover:border-pink-500/40 transition-colors">
                    {getIcon(service.iconName)}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4">
                  <h3 className="text-sm font-extrabold text-slate-100 group-hover:text-pink-300 transition-colors mb-1.5 leading-snug">
                    {service.cardTitle}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </div>

              {/* Card Footer CTA */}
              <div className="px-4 pb-4 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:text-pink-400 transition-colors">
                <span>{language === 'bn' ? 'সঙ্গী খুঁজুন' : language === 'hi' ? 'साथी चुनें' : 'Find Companions'}</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          ))}
        </div>

        {/* "View All 36 Services" / "Show Less" Expand/Collapse Button */}
        {hasMore && (
          <div className="mt-10 flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-pink-500/40 text-slate-200 hover:text-white text-xs sm:text-sm font-extrabold shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              {isExpanded ? (
                <>
                  <span>{language === 'bn' ? 'সংক্ষেপ করুন (শীর্ষ ৮টি দেখুন)' : language === 'hi' ? 'कम देखें (शीर्ष 8)' : 'Show Less (Top 8)'}</span>
                  <ChevronUp className="w-4 h-4 text-pink-400" />
                </>
              ) : (
                <>
                  <span>
                    {language === 'bn' 
                      ? `সব ${filteredServices.length}টি পরিষেবা দেখুন` 
                      : language === 'hi'
                      ? `सभी ${filteredServices.length} सेवाएं देखें`
                      : `View All ${filteredServices.length} Services`}
                  </span>
                  <ChevronDown className="w-4 h-4 text-amber-400 animate-bounce" />
                </>
              )}
            </button>
            <p className="text-[11px] text-slate-500 mt-2">
              {isExpanded 
                ? (language === 'bn' ? '৩৬টি পরিষেবার সবকটি প্রদর্শিত হচ্ছে' : 'Displaying all 36 companion services')
                : (language === 'bn' ? 'স্ক্রোল কমাতে শীর্ষ ৮টি জনপ্রিয় পরিষেবা দেখানো হচ্ছে' : 'Showing top 8 popular services to prevent long scrolling')}
            </p>
          </div>
        )}

      </div>
    </section>
  );
};
