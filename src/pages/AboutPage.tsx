import React from 'react';
import { Heart, Compass, Shield, Users, ArrowRight } from 'lucide-react';

interface AboutPageProps {
  onExplore: () => void;
  onJoinCompanion: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onExplore, onJoinCompanion }) => {
  return (
    <div className="py-12 lg:py-20 bg-slate-950 text-slate-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* EXACT Heading & Subheading */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 text-amber-300 text-xs font-semibold mb-4 border border-amber-400/20">
            About Our Community
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-100 tracking-tight mb-4">
            About PairUpToday
          </h1>
          <p className="text-lg sm:text-xl font-medium text-pink-400">
            Bringing People Together, Creating Meaningful Experiences.
          </p>
        </div>

        {/* EXACT Body Text */}
        <div className="prose prose-invert max-w-none space-y-6 text-slate-300 text-base sm:text-lg leading-relaxed bg-slate-900/50 p-6 sm:p-10 rounded-2xl border border-slate-800 shadow-xl">
          <p>
            PairUpToday is a companionship platform designed to bring people together and make everyday experiences more enjoyable, comfortable and meaningful.
          </p>
          <p>
            Whether you are looking for someone to accompany you to a café, explore a new city, attend an event, travel, go shopping or simply enjoy a friendly conversation, PairUpToday helps you discover a companion who matches your preferences and needs.
          </p>
          <p>
            We also create opportunities for individuals who want to offer companionship services, share their interests and skills, connect with people and earn through their time and availability.
          </p>
        </div>

        {/* Our Mission */}
        <div className="mt-12 bg-slate-900/40 p-6 sm:p-8 rounded-2xl border border-slate-800">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-3 mb-4">
            <Compass className="w-6 h-6 text-sky-400" />
            Our Mission
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Our mission is to make companionship more accessible by creating a platform where people can connect, discover experiences and build meaningful social connections.
          </p>
        </div>

        {/* What We Offer */}
        <div className="mt-12">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mb-6 flex items-center gap-3">
            <Heart className="w-6 h-6 text-pink-400" />
            What We Offer
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold text-amber-300 mb-2">Personal Companionship</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Find someone to share everyday activities and special moments.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold text-sky-300 mb-2">Lifestyle Experiences</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Enjoy shopping, dining, movies, events, travel and local exploration with a companion.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold text-emerald-300 mb-2">Travel & Tourism</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Discover new places and local experiences with suitable companions.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800">
              <h3 className="text-sm font-bold text-purple-300 mb-2">Senior Companionship</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Help older adults enjoy friendly company and everyday social activities.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 md:col-span-2">
              <h3 className="text-sm font-bold text-rose-300 mb-2">Earning Opportunities</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Allow companions to offer their services, manage their availability and earn through eligible bookings.
              </p>
            </div>
          </div>
        </div>

        {/* Our Commitment to Safety */}
        <div className="mt-12 bg-slate-900/40 p-6 sm:p-8 rounded-2xl border border-slate-800">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-emerald-400" />
            Our Commitment to Safety
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Trust and safety are important to us. PairUpToday is designed with identity verification, account security, booking records, secure payment processes and meeting verification features to support a safer experience for clients and companions.
          </p>
        </div>

        {/* Our Vision */}
        <div className="mt-12 bg-slate-900/40 p-6 sm:p-8 rounded-2xl border border-slate-800">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-3 mb-4">
            <Users className="w-6 h-6 text-amber-400" />
            Our Vision
          </h2>
          <p className="text-slate-300 leading-relaxed">
            We envision a world where no one has to miss out on meaningful experiences simply because they do not have someone to accompany them. We aim to build a trusted companionship community where people can connect, explore, experience and grow together.
          </p>
        </div>

        {/* Be Part of PairUpToday */}
        <div className="mt-14 p-8 rounded-2xl bg-gradient-to-r from-slate-900 via-pink-950/20 to-slate-900 border border-pink-500/20 text-center">
          <h2 className="text-2xl font-extrabold text-slate-100 mb-6">
            Be Part of PairUpToday
          </h2>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8 text-sm text-slate-300">
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex-1 w-full">
              <strong className="text-amber-400 block mb-1">For Clients:</strong>
              Find the right companion for your next experience.
              <button
                onClick={onExplore}
                className="mt-3 block w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
              >
                Explore Companions
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex-1 w-full">
              <strong className="text-pink-400 block mb-1">For Companions:</strong>
              Join our community, share your time and create your earning opportunities.
              <button
                onClick={onJoinCompanion}
                className="mt-3 block w-full py-2 px-3 rounded-lg bg-pink-600 hover:bg-pink-500 text-xs font-semibold text-white"
              >
                Register as Companion
              </button>
            </div>
          </div>

          {/* EXACT Tagline */}
          <div className="pt-4 border-t border-slate-800 text-base sm:text-lg font-bold bg-gradient-to-r from-amber-300 via-pink-400 to-sky-400 bg-clip-text text-transparent">
            PairUpToday — Your Time. Your Choice. Your Companion.
          </div>
        </div>

      </div>
    </div>
  );
};
