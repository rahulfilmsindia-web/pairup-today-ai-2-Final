export interface ServiceItem {
  id: number;
  name: string;
  description: string;
  iconName: string;
  category: 'social' | 'lifestyle' | 'travel' | 'wellness' | 'culture' | 'care';
  badgeLabel?: string;
  image: string;
}

export const PAIRUP_SERVICES: ServiceItem[] = [
  {
    id: 1,
    name: "Social & Conversation Companion",
    description: "Friendly companionship for conversations, casual chats, sharing stories and spending pleasant leisure time together.",
    iconName: "MessageCircleHeart",
    category: "social",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 2,
    name: "Cafe & Restaurant Companion",
    description: "A companion for visiting cafés, restaurants, coffee shops and new food destinations and enjoying time together.",
    iconName: "Coffee",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 3,
    name: "Movie & Cinema Companion",
    description: "Enjoy movies together at cinema halls, multiplexes and special movie screenings.",
    iconName: "Film",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 4,
    name: "Shopping Companion",
    description: "Companionship for shopping malls, clothing stores, markets and other shopping activities, including general assistance in choosing items.",
    iconName: "ShoppingBag",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 5,
    name: "Travel & Holiday Companion",
    description: "Friendly companionship for domestic and international travel, holidays, tours and tourism trips.",
    iconName: "Plane",
    category: "travel",
    image: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 6,
    name: "City Tour & Sightseeing Companion",
    description: "Explore city attractions, popular spots, parks and new places with a companion.",
    iconName: "Compass",
    category: "travel",
    image: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 7,
    name: "Event & Exhibition Companion",
    description: "Companionship for exhibitions, fairs, book fairs, cultural programmes and public events.",
    iconName: "Calendar",
    category: "culture",
    image: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 8,
    name: "Wedding & Ceremony Companion",
    description: "Companionship for weddings, receptions, family functions and social ceremonies.",
    iconName: "Sparkles",
    category: "social",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 9,
    name: "Party & Clubbing Companion",
    description: "Companionship for social parties, special occasions and permitted entertainment events.",
    iconName: "PartyPopper",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 10,
    name: "Concert & Live Music Companion",
    description: "Enjoy live music, concerts, band performances and music festivals together.",
    iconName: "Music",
    category: "culture",
    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 11,
    name: "Sports & Stadium Companion",
    description: "Enjoy cricket, football and other sports at stadiums and sporting events with a companion.",
    iconName: "Trophy",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 12,
    name: "Fitness & Walking Companion",
    description: "Companionship for walking, jogging, spending time in parks and general fitness activities.",
    iconName: "Activity",
    category: "wellness",
    image: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 13,
    name: "Outdoor Activities Companion",
    description: "Companionship for picnics, park visits, spending time in nature and other outdoor activities.",
    iconName: "Trees",
    category: "wellness",
    image: "https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 14,
    name: "Hobby & Creative Activities Companion",
    description: "Spend time together on painting, photography, handicrafts and other creative hobbies.",
    iconName: "Palette",
    category: "culture",
    image: "https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 15,
    name: "Gaming & Indoor Activities Companion",
    description: "Enjoy chess, board games, card games and other indoor recreational activities together.",
    iconName: "Gamepad2",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 16,
    name: "Study & Co-working Companion",
    description: "Spend time studying or working together in libraries, study spaces and co-working environments.",
    iconName: "BookOpen",
    category: "social",
    image: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 17,
    name: "Senior Citizen Companionship",
    description: "Friendly companionship for senior citizens through conversations, casual chats, walking and social activities.",
    iconName: "HeartHandshake",
    category: "care",
    image: "https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 18,
    name: "Hospital & Medical Appointment Companion",
    description: "Companionship during travel to hospitals, clinics or medical appointments and while waiting. This is not a medical service.",
    iconName: "Building2",
    category: "care",
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 19,
    name: "Daily Errands & Market Companion",
    description: "Companionship for markets, post offices, banks, shopping and other ordinary daily errands.",
    iconName: "CheckSquare",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 20,
    name: "Religious & Spiritual Visit Companion",
    description: "Companionship for visits to temples, mosques, churches, gurudwaras and other religious or spiritual places.",
    iconName: "Sun",
    category: "culture",
    image: "https://images.unsplash.com/photo-1561361066-51368ca52219?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 21,
    name: "Airport & Railway Travel Companion",
    description: "Companionship and general assistance before or after journeys at airports and railway stations.",
    iconName: "TrainTrack",
    category: "travel",
    image: "https://images.unsplash.com/photo-1530521954074-e64f6810b32d?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 22,
    name: "Local Exploration & Food Discovery Companion",
    description: "Discover local food, street food, popular markets and new places around the city with a companion.",
    iconName: "Utensils",
    category: "lifestyle",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 23,
    name: "Tourist Guide & Local Exploration Companion",
    description: "Explore historical places, heritage sites, tourist attractions, local culture and tourism destinations with a companion. Professional guiding must be performed only where the required qualifications and permissions are available.",
    iconName: "MapPin",
    category: "travel",
    image: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=600&q=80"
  },
  {
    id: 24,
    name: "Elder Care & Daily Living Assistance Companion",
    description: "Companionship for elderly individuals in everyday life, including walking, general assistance, meal reminders, shopping, social activities and accompanying them to necessary appointments.",
    iconName: "ShieldCheck",
    category: "care",
    image: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=600&q=80"
  }
];
