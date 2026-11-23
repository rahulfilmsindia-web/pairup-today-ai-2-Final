export type ServiceCategory = 'social' | 'travel' | 'creator' | 'active' | 'care';

export interface ServiceItem {
  id: number;
  slug?: string;
  name: string;
  chipLabel: string;
  cardTitle: string;
  description: string;
  iconName: string;
  category: ServiceCategory;
  badgeLabel?: string;
  image: string;
}

export const SERVICE_CATEGORIES: { id: 'all' | ServiceCategory; label: string }[] = [
  { id: 'all', label: 'All 36 Services' },
  { id: 'social', label: 'Social & Entertainment' },
  { id: 'travel', label: 'Travel & Exploration' },
  { id: 'creator', label: 'Creator & Lifestyle' },
  { id: 'active', label: 'Active & Hobbies' },
  { id: 'care', label: 'Care & Family' }
];

// =============================================================================
// PAIRUP TODAY — 36 AUTHORITATIVE PLATONIC SERVICES (STRICT SERIAL 1 TO 36)
// =============================================================================
export const PAIRUP_SERVICES: ServiceItem[] = [
  {
    id: 1,
    slug: 'social-conversation',
    name: 'Social & Conversation Companion',
    cardTitle: 'Social & Conversation',
    chipLabel: 'Hangout',
    description: 'Friendly companionship for casual chats, meaningful conversations, sharing stories, and relaxing leisure time together.',
    iconName: 'MessageCircleHeart',
    category: 'social',
    image: '/assets/services/social_conversation_rabindra_sarobar.jpg'
  },
  {
    id: 2,
    slug: 'cafe-restaurant',
    name: 'Cafe & Restaurant Companion',
    cardTitle: 'Cafe & Dining',
    chipLabel: 'Dining',
    description: 'A charming companion for visiting trendy cafés, coffee bistros, culinary spots, and enjoying delightful meals together.',
    iconName: 'Coffee',
    category: 'social',
    image: '/assets/services/cafe_restaurant_dining.jpg'
  },
  {
    id: 3,
    slug: 'movie-cinema',
    name: 'Movie & Cinema Companion',
    cardTitle: 'Movie Buddy',
    chipLabel: 'Movies',
    description: 'Enjoy cinema releases, IMAX screenings, film festivals, and entertainment shows with an enthusiastic movie partner.',
    iconName: 'Film',
    category: 'social',
    image: '/assets/services/movie_cinema_pvr.jpg'
  },
  {
    id: 4,
    slug: 'shopping',
    name: 'Shopping Companion',
    cardTitle: 'Shopping Buddy',
    chipLabel: 'Shopping',
    description: 'Companionship for shopping malls, fashion streets, boutique visits, and friendly assistance with style selections.',
    iconName: 'ShoppingBag',
    category: 'social',
    image: '/assets/services/shopping_fashion_mall.jpg'
  },
  {
    id: 5,
    slug: 'travel-holiday',
    name: 'Travel & Holiday Companion',
    cardTitle: 'Travel Buddy',
    chipLabel: 'Travel',
    description: 'Friendly, reliable companionship for domestic and international tours, holiday getaways, and scenic road trips.',
    iconName: 'Plane',
    category: 'travel',
    image: '/assets/services/travel_holiday_hill_station.jpg'
  },
  {
    id: 6,
    slug: 'city-tour',
    name: 'City Tour & Sightseeing Companion',
    cardTitle: 'City Tour',
    chipLabel: 'City Tour',
    description: 'Explore city landmarks, historic monuments, heritage walks, and waterfronts with an energetic local buddy.',
    iconName: 'Compass',
    category: 'travel',
    image: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 7,
    slug: 'event-exhibition',
    name: 'Event & Exhibition Companion',
    cardTitle: 'Events & Expos',
    chipLabel: 'Events',
    description: 'Explore art exhibitions, trade expos, literature festivals, tech summits, and cultural shows with good company.',
    iconName: 'Calendar',
    category: 'social',
    image: '/assets/services/event_exhibition_art.jpg'
  },
  {
    id: 8,
    slug: 'wedding-ceremony',
    name: 'Wedding & Ceremony Companion',
    cardTitle: 'Weddings & Events',
    chipLabel: 'Weddings',
    description: 'Respectful, well-groomed companionship for wedding receptions, sangeet functions, and formal family ceremonies.',
    iconName: 'Sparkles',
    category: 'social',
    image: '/assets/services/wedding_ceremony_event.jpg'
  },
  {
    id: 9,
    slug: 'party-clubbing',
    name: 'Party & Clubbing Companion',
    cardTitle: 'Party & Nightlife',
    chipLabel: 'Nightlife',
    description: 'Companionship for social parties, lounge evenings, weekend celebrations, and verified entertainment venues.',
    iconName: 'PartyPopper',
    category: 'social',
    image: '/assets/services/party_clubbing_nightlife.jpg'
  },
  {
    id: 10,
    slug: 'concert-music',
    name: 'Concert & Live Music Companion',
    cardTitle: 'Live Concerts',
    chipLabel: 'Concerts',
    description: 'Attend live music concerts, band performances, acoustic festivals, and musical gatherings together.',
    iconName: 'Music',
    category: 'social',
    image: '/assets/services/concert_live_music.jpg'
  },
  {
    id: 11,
    slug: 'sports-stadium',
    name: 'Sports & Stadium Companion',
    cardTitle: 'Sports & Stadium',
    chipLabel: 'Sports',
    description: 'Catch live cricket matches, football games, marathon cheering, or athletic tournaments with an enthusiastic sports buddy.',
    iconName: 'Trophy',
    category: 'active',
    image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 12,
    slug: 'fitness-walking',
    name: 'Fitness & Walking Companion',
    cardTitle: 'Fitness & Walking',
    chipLabel: 'Fitness',
    description: 'Motivational company for morning walks, park jogs, gym workout sessions, yoga routines, or light outdoor stretching.',
    iconName: 'Activity',
    category: 'active',
    image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 13,
    slug: 'outdoor-activities',
    name: 'Outdoor Activities Companion',
    cardTitle: 'Outdoor Fun',
    chipLabel: 'Outdoors',
    description: 'Companionship for hiking trails, camping weekends, cycling routes, beach visits, and nature exploration trips.',
    iconName: 'Trees',
    category: 'active',
    image: 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 14,
    slug: 'hobby-creative',
    name: 'Hobby & Creative Activities Companion',
    cardTitle: 'Hobbies & Crafts',
    chipLabel: 'Hobbies',
    description: 'Share creative pursuits including painting, pottery workshops, photography walks, gardening, cooking, or DIY crafts.',
    iconName: 'Palette',
    category: 'active',
    image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 15,
    slug: 'gaming-indoor',
    name: 'Gaming & Indoor Activities Companion',
    cardTitle: 'Gaming & Arcade',
    chipLabel: 'Gaming',
    description: 'Play board games, chess, escape rooms, bowling, arcade games, PlayStation, or multiplayer e-sports with a friendly partner.',
    iconName: 'Gamepad2',
    category: 'active',
    image: 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 16,
    slug: 'study-coworking',
    name: 'Study & Co-working Companion',
    cardTitle: 'Study & Co-work',
    chipLabel: 'Co-work',
    description: 'Focused companionship at libraries, co-working spaces, study cafes, or preparation sessions for exams and projects.',
    iconName: 'BookOpen',
    category: 'active',
    image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 17,
    slug: 'senior-care',
    name: 'Senior Citizen Companionship',
    cardTitle: 'Senior Care',
    chipLabel: 'Senior Care',
    description: 'Heartfelt, respectful companionship for seniors through engaging conversations, slow walking, and compassionate attention.',
    iconName: 'HeartHandshake',
    category: 'care',
    image: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 18,
    slug: 'hospital-medical',
    name: 'Hospital & Medical Appointment Companion',
    cardTitle: 'Hospital Visit',
    chipLabel: 'Medical',
    description: 'Caring companionship during hospital and clinic visits, prescription collection, and waiting room support (non-medical).',
    iconName: 'Building2',
    category: 'care',
    image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 19,
    slug: 'daily-errands',
    name: 'Daily Errands & Market Companion',
    cardTitle: 'Daily Errands',
    chipLabel: 'Errands',
    description: 'Helpful companion for grocery visits, vegetable markets, postal errands, banking chores, and daily task management.',
    iconName: 'CheckSquare',
    category: 'care',
    image: 'https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 20,
    slug: 'spiritual-visit',
    name: 'Religious & Spiritual Visit Companion',
    cardTitle: 'Spiritual Visits',
    chipLabel: 'Spiritual',
    description: 'Peaceful companionship for visits to temples, gurudwaras, mosques, churches, ashrams, and meditation centers.',
    iconName: 'Sun',
    category: 'care',
    image: 'https://images.unsplash.com/photo-1561361066-51368ca52219?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 21,
    slug: 'airport-railway',
    name: 'Airport & Railway Travel Companion',
    cardTitle: 'Airport & Rail',
    chipLabel: 'Transit',
    description: 'Reliable meet-and-greet companionship and assistance before, during, or after journeys at airports and railway stations.',
    iconName: 'TrainTrack',
    category: 'travel',
    image: 'https://images.unsplash.com/photo-1530521954074-e64f6810b32d?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 22,
    slug: 'food-discovery',
    name: 'Local Exploration & Food Discovery Companion',
    cardTitle: 'Food & Local Spots',
    chipLabel: 'Food Walk',
    description: 'Discover legendary street food alleys, hidden regional culinary gems, and bustling midnight bazaars.',
    iconName: 'Utensils',
    category: 'travel',
    image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 23,
    slug: 'tourist-guide',
    name: 'Tourist Guide & Local Exploration Companion',
    cardTitle: 'Local Guide',
    chipLabel: 'Local Guide',
    description: 'Knowledgeable companionship for cultural monuments, architectural wonders, and authentic local traditions.',
    iconName: 'MapPin',
    category: 'travel',
    image: 'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 24,
    slug: 'elder-assistance',
    name: 'Elder Care & Daily Living Assistance Companion',
    cardTitle: 'Elder Support',
    chipLabel: 'Elder Help',
    description: 'Supportive presence for elders in daily routines, garden strolls, mealtime company, and uplifting social interaction.',
    iconName: 'ShieldCheck',
    category: 'care',
    image: 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 25,
    slug: 'personal-driver',
    name: 'Personal Driver Companion',
    cardTitle: 'Personal Driver',
    chipLabel: 'Driver',
    description: 'Licensed, courteous personal driver companion for comfortable city commutes, outstation drives, or business travel in your vehicle.',
    iconName: 'Car',
    category: 'travel',
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 26,
    slug: 'personal-photographer',
    name: 'Personal Photographer Companion',
    cardTitle: 'Personal Photographer',
    chipLabel: 'Photoshoot',
    description: 'Skilled photographer companion for portraits, street photography, Instagram aesthetic reels, and capturing your best memories.',
    iconName: 'Camera',
    category: 'creator',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 27,
    slug: 'content-creator-buddy',
    name: 'Content Creator Buddy',
    cardTitle: 'Content Creator Buddy',
    chipLabel: 'Content Collab',
    description: 'Creative partner for collaborating on YouTube vlogs, TikTok/Reels content creation, podcasting, and script brainstorms.',
    iconName: 'Video',
    category: 'creator',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 28,
    slug: 'influencer-promotion',
    name: 'Influencer Promotion Companion',
    cardTitle: 'Influencer Promotion',
    chipLabel: 'Influencer',
    description: 'Social media influencer companionship to attend brand launches, cafe inaugurations, and promote lifestyle experiences.',
    iconName: 'Megaphone',
    category: 'creator',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 29,
    slug: 'makeup-styling',
    name: 'Makeup & Styling Companion',
    cardTitle: 'Makeup & Styling',
    chipLabel: 'Makeup',
    description: 'Personal styling and beauty companion to assist with shopping, wardrobe curation, makeup suggestions, and makeover looks.',
    iconName: 'Sparkles',
    category: 'creator',
    image: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 30,
    slug: 'event-party-host',
    name: 'Event & Party Host Companion',
    cardTitle: 'Event & Party Host',
    chipLabel: 'Party Host',
    description: 'Charismatic, articulate host companion to welcome guests, coordinate games, and energize birthdays or corporate get-togethers.',
    iconName: 'Users',
    category: 'creator',
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 31,
    slug: 'astrology-vastu',
    name: 'Astrology & Vastu Consultation Companion',
    cardTitle: 'Astrology & Vastu',
    chipLabel: 'Astrology',
    description: 'Astrology, tarot, and vastu consultation companionship for insightful horoscope readings and positive home energy guidance.',
    iconName: 'Compass',
    category: 'creator',
    image: 'https://images.unsplash.com/photo-1532968961962-8a0cb3a2d4f5?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 32,
    slug: 'pet-care-dog-walk',
    name: 'Pet Care & Dog Walking Companion',
    cardTitle: 'Pet Care & Dog Walk',
    chipLabel: 'Pet Care',
    description: 'Animal-loving companion to walk your dogs, accompany you to pet cafes, or spend joyful outdoor playtime with friendly pets.',
    iconName: 'Footprints',
    category: 'care',
    image: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 33,
    slug: 'study-home-tutor',
    name: 'Study & Home Tutor Companion',
    cardTitle: 'Study & Home Tutor',
    chipLabel: 'Home Tutor',
    description: 'Dedicated academic companion for homework guidance, conceptual discussions, language practice, and disciplined study habits.',
    iconName: 'GraduationCap',
    category: 'care',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 34,
    slug: 'child-care-babysitting',
    name: 'Child Care & Babysitting Companion',
    cardTitle: 'Child Care & Babysitting',
    chipLabel: 'Babysitting',
    description: 'Vetted, caring companion for engaging storytelling, park playtimes, arts and crafts, and supportive family supervision.',
    iconName: 'Baby',
    category: 'care',
    image: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 35,
    slug: 'home-cooking-buddy',
    name: 'Home Cooking & Chef Companion',
    cardTitle: 'Home Cooking Buddy',
    chipLabel: 'Home Chef',
    description: 'Culinary companion to cook delicious authentic home meals together, explore new regional cuisines, and bake desserts.',
    iconName: 'ChefHat',
    category: 'care',
    image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=600&q=80'
  },
  {
    id: 36,
    slug: 'event-security-bouncer',
    name: 'Event Security & Bouncer Companion',
    cardTitle: 'Event Security / Bouncer',
    chipLabel: 'Bodyguard',
    description: 'Professional, imposing security and discrete personal safety companion for late-night transit, VIP events, or crowded venues.',
    iconName: 'ShieldAlert',
    category: 'care',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80'
  }
];
