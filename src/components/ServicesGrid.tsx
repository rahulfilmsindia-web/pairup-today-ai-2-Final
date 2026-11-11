import React, { useState } from 'react';
import { PAIRUP_SERVICES, ServiceItem } from '../constants/services';
import { 
  MessageCircleHeart, Coffee, Film, ShoppingBag, Plane, Compass, 
  Calendar, Sparkles, PartyPopper, Music, Trophy, Activity, 
  Trees, Palette, Gamepad2, BookOpen, HeartHandshake, Building2, 
  CheckSquare, Sun, TrainTrack, Utensils, MapPin, ShieldCheck,
  ArrowRight
} from 'lucide-react';

interface ServicesGridProps {
  onSelectService: (service: ServiceItem) => void;
}

// Icon mapper for the 24 services
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
    ShieldCheck: <ShieldCheck className="w-5 h-5 text-pink-400" />
  };
  return iconMap[iconName] || <Sparkles className="w-5 h-5 text-amber-400" />;
};

export const ServicesGrid: React.FC<ServicesGridProps> = ({ onSelectService }) => {
  const [filter, setFilter] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All 24 Services' },
    { id: 'social', label: 'Social' },
    { id: 'lifestyle', label: 'Lifestyle' },
    { id: 'travel', label: 'Travel & Tours' },
    { id: 'wellness', label: 'Fitness & Outdoors' },
    { id: 'culture', label: 'Culture & Arts' },
    { id: 'care', label: 'Care & Assistance' }
  ];

  const filteredServices = filter === 'all' 
    ? PAIRUP_SERVICES 
    : PAIRUP_SERVICES.filter(s => s.category === filter);

  return (
    <section className="py-16 bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-amber-400 mb-2">
              Curated Experiences
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              24 Distinctive Companionship Services
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
              From casual café visits to travel partners and senior assistance, select the exact service tailored to your preference.
            </p>
          </div>

          {/* Interactive filter tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto max-w-full">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors ${
                  filter === cat.id
                    ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* 24 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredServices.map(service => (
            <div
              key={service.id}
              onClick={() => onSelectService(service)}
              className="group cursor-pointer rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-amber-400/40 overflow-hidden shadow-lg shadow-black/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-amber-500/10 flex flex-col"
            >
              {/* Card Image */}
              <div className="relative h-44 w-full overflow-hidden bg-slate-800">
                <img
                  src={service.image}
                  alt={service.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                
                {/* Numeric Index Tag */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-slate-700/60 text-[11px] font-mono text-amber-300 font-bold">
                  {String(service.id).padStart(2, '0')}
                </div>

                {/* Service Icon */}
                <div className="absolute bottom-3 left-3 p-2 rounded-lg bg-slate-900/90 backdrop-blur-md border border-slate-700/60">
                  {getIcon(service.iconName)}
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 group-hover:text-amber-300 transition-colors mb-2 leading-snug">
                    {service.name}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {service.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-amber-400 font-semibold">
                  <span>Discover Companions</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
