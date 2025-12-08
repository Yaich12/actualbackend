import { Link } from 'react-router-dom';

export default function HeroSection() {
  // Booking system screenshots - using Unsplash images that represent booking/dashboard interfaces
  const bookingImages = [
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1740&auto=format&fit=crop", // Dashboard/analytics
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1715&auto=format&fit=crop", // Calendar/scheduling
    "https://images.unsplash.com/photo-1551650975-87deedd944c3?q=80&w=1674&auto=format&fit=crop", // Data visualization/analytics
  ];

  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top section with title and text */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-black mb-4 sm:mb-6 tracking-tight">
            Selma+
          </h1>
          <p className="text-lg sm:text-xl text-black mb-8 sm:mb-10 max-w-2xl mx-auto">
            Say hello to the newest members of the family.
          </p>
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-12 sm:mb-16">
            <Link
              to="#demo"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 sm:px-10 sm:py-4 rounded-full text-base sm:text-lg transition-colors duration-200 min-w-[160px] text-center"
            >
              Læs mere
            </Link>
            <Link
              to="/signup"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 sm:px-10 sm:py-4 rounded-full text-base sm:text-lg transition-colors duration-200 min-w-[160px] text-center"
            >
              Prøv gratis
            </Link>
          </div>
        </div>

        {/* Three booking system images - iPhone style layout */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 lg:gap-8 mt-8 sm:mt-12">
          {/* Left image - angled rear-left perspective */}
          <div className="relative w-full sm:w-[30%] max-w-[300px] transform -rotate-6 sm:-rotate-12 hover:rotate-0 transition-transform duration-300">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-white">
              <img
                src={bookingImages[0]}
                alt="Selma+ Booking System - Dashboard View"
                className="w-full h-auto object-cover aspect-[9/16] sm:aspect-[3/4]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
            </div>
          </div>

          {/* Center image - side profile */}
          <div className="relative w-full sm:w-[30%] max-w-[300px] z-10 transform hover:scale-105 transition-transform duration-300">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-white">
              <img
                src={bookingImages[1]}
                alt="Selma+ Booking System - Calendar View"
                className="w-full h-auto object-cover aspect-[9/16] sm:aspect-[3/4]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
            </div>
          </div>

          {/* Right image - angled rear-right perspective */}
          <div className="relative w-full sm:w-[30%] max-w-[300px] transform rotate-6 sm:rotate-12 hover:rotate-0 transition-transform duration-300">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl bg-white">
              <img
                src={bookingImages[2]}
                alt="Selma+ Booking System - Analytics View"
                className="w-full h-auto object-cover aspect-[9/16] sm:aspect-[3/4]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
