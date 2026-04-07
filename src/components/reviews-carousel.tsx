"use client";

import { Star } from "lucide-react";

const reviews = [
  {
    text: "I was skeptical about mobile detailing but these guys showed up on time with all the gear and my 5-year-old SUV looks brand new. Absolutely floored.",
    author: "Mike T.",
    location: "NW Calgary, AB",
  },
  {
    text: "Booked the ceramic package for my Porsche. The attention to detail is insane — every panel, every crevice. Worth every penny and then some.",
    author: "Amanda R.",
    location: "SW Calgary, AB",
  },
  {
    text: "They came to my office parking lot while I worked. Came back to a car that looked like it just rolled off the showroom floor. Game changer.",
    author: "James L.",
    location: "SE Calgary, AB",
  },
  {
    text: "The interior shampoo removed 3 years of kid mess. I genuinely said WOW out loud when I saw it. Great name, great service.",
    author: "Sarah K.",
    location: "Airdrie, AB",
  },
  {
    text: "Used them for my entire sales fleet — 8 vehicles. Competitive pricing, professional crew, and every car came back immaculate. Will use monthly.",
    author: "David M.",
    location: "Cochrane, AB",
  },
  {
    text: "Didn't expect much from a phone booking but the technician was a true pro. Explained every step, used top-shelf products. 10/10 experience.",
    author: "Priya N.",
    location: "Okotoks, AB",
  },
];

function StarRating() {
  return (
    <div className="flex gap-0.5 mb-3.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="size-4 fill-yellow text-yellow" />
      ))}
    </div>
  );
}

export default function ReviewsCarousel() {
  // Duplicate for seamless infinite scroll
  const allReviews = [...reviews, ...reviews];

  return (
    <div className="overflow-hidden mx-[-60px] max-md:mx-[-24px]">
      <style>{`
        @keyframes scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      <div
        className="flex gap-6 mt-14 w-max"
        style={{ animation: "scroll 35s linear infinite" }}
      >
        {allReviews.map((review, i) => (
          <div
            key={i}
            className="bg-white/5 border border-white/[0.08] rounded-[14px] p-8 px-9 min-w-[340px] max-w-[340px] shrink-0"
          >
            <StarRating />
            <p className="text-[0.95rem] text-silver leading-[1.75] mb-5 italic">
              &ldquo;{review.text}&rdquo;
            </p>
            <div className="font-[family-name:var(--font-barlow-condensed)] text-base font-bold tracking-wide uppercase text-white">
              {review.author}
            </div>
            <div className="text-[0.8rem] text-mid mt-0.5">
              {review.location}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
