// The fixed list of business types (niches).
// Every idea gets sorted into exactly one of these, so the same idea always lands in the same place.
// "name" is what the user sees ("8 out of 32 cloud kitchen companies…").
// "about" only helps Gemini pick the right one. Narrower is better: a sneaker brand should be
// compared with sneaker brands, not with all of fashion.

module.exports = [
  // Grocery and food delivery
  { name: "quick commerce", about: "10–30 minute delivery of groceries and daily essentials from small warehouses (Blinkit, Zepto, Gopuff)" },
  { name: "online grocery", about: "scheduled or next-day grocery delivery (BigBasket, Webvan)" },
  { name: "fresh meat, fish and produce", about: "online meat, fish, fruits and vegetables (Licious, FreshToHome)" },
  { name: "milk and daily subscription", about: "daily morning delivery of milk, bread and essentials by subscription" },
  { name: "food delivery", about: "apps that deliver food from many restaurants (Swiggy, Zomato)" },
  { name: "cloud kitchen", about: "delivery-only kitchens and online-only food brands (Rebel Foods)" },
  { name: "home food and tiffin", about: "home chefs, tiffin services, daily meal subscriptions" },
  { name: "healthy meals and diet plans", about: "salad, keto, diet and calorie-counted meal brands and subscriptions" },

  // Eating out
  { name: "café and coffee chain", about: "dine-in cafés, coffee and tea chains, chai cafés" },
  { name: "restaurant and fast-food chain", about: "dine-in restaurants, fast-food and pizza chains" },
  { name: "bakery and desserts", about: "bakeries, cake shops, dessert, ice-cream and chocolate brands and chains" },
  { name: "bars, pubs and breweries", about: "pubs, bars, microbreweries and nightlife venues" },

  // Food and drink brands
  { name: "snacks and packaged food", about: "own-brand snacks, namkeen, ready-to-eat and packaged food" },
  { name: "beverage brands", about: "juices, energy drinks, soft drinks, kombucha and other drink brands" },
  { name: "coffee and tea brands", about: "packaged coffee and tea brands sold online or in stores" },
  { name: "dairy and plant-based brands", about: "milk products, paneer, curd, plant-based milk and alternatives" },
  { name: "alcohol brands", about: "beer, wine, spirits and craft liquor brands" },
  { name: "nutrition and supplements", about: "protein, vitamins, health supplements and sports nutrition brands" },

  // Transport and vehicles
  { name: "bike taxi", about: "two-wheeler ride booking (Rapido)" },
  { name: "ride hailing", about: "cab and auto booking apps (Ola, Uber)" },
  { name: "vehicle rental", about: "self-drive car, bike or scooter rental and subscription (Zoomcar, Yulu)" },
  { name: "used cars and bikes", about: "buying and selling used cars or two-wheelers (Cars24, Droom)" },
  { name: "electric vehicle maker", about: "companies making electric scooters, bikes, cars, autos or trucks" },
  { name: "EV charging and battery swapping", about: "charging stations, battery swapping networks for electric vehicles" },
  { name: "car and bike services", about: "vehicle servicing, repair, car wash, spare parts booking" },
  { name: "parcel and courier delivery", about: "courier, parcel, same-day and pickup-drop delivery services" },
  { name: "trucking and freight", about: "truck booking, freight marketplaces, long-haul logistics" },
  { name: "drones and robotics", about: "drone delivery, drone services and consumer or industrial robots" },

  // Education
  { name: "test prep", about: "exam preparation apps and coaching for JEE, NEET, UPSC, CAT, GRE and similar" },
  { name: "school tutoring", about: "learning apps and online tutoring for school kids" },
  { name: "kids coding and hobby classes", about: "coding, robotics, music, art and hobby classes for children" },
  { name: "upskilling and courses", about: "online courses, coding bootcamps, job skills for adults" },
  { name: "language learning", about: "apps and classes to learn English or other languages" },
  { name: "higher education and study abroad", about: "online degrees, college admissions, study-abroad help" },
  { name: "school and college software", about: "software sold to schools, colleges and coaching centres" },

  // Health
  { name: "fitness", about: "gyms, fitness apps, home workouts, yoga" },
  { name: "online doctor", about: "online doctor consultations and digital clinics" },
  { name: "online pharmacy", about: "medicine ordering and delivery" },
  { name: "diagnostics", about: "lab tests, home sample collection, health checkups" },
  { name: "clinic chains", about: "clinic chains, dental, eye care and specialty clinics" },
  { name: "elder care and home nursing", about: "care for elderly people, home nurses, attendants" },
  { name: "women's health", about: "period care, fertility, pregnancy and women's health apps and products" },
  { name: "mental health", about: "therapy, counselling, meditation and wellbeing apps" },
  { name: "ayurveda and wellness", about: "ayurvedic, herbal and natural wellness products and services" },
  { name: "sexual wellness", about: "sexual health products, condoms, intimacy and sexual wellness brands" },
  { name: "healthcare software", about: "software for hospitals, clinics, doctors and pharmacies" },

  // Fashion
  { name: "fashion e-commerce", about: "online fashion marketplaces and multi-brand fashion stores (Myntra, Jabong)" },
  { name: "clothing brands", about: "own-brand everyday clothing, t-shirts, streetwear sold mainly online" },
  { name: "footwear and sneaker brands", about: "own-brand sneakers, shoes, sandals and footwear" },
  { name: "ethnic wear", about: "sarees, kurtas, lehengas and Indian ethnic clothing brands and stores" },
  { name: "innerwear and activewear", about: "innerwear, loungewear, sportswear and athleisure brands" },
  { name: "bags, watches and accessories", about: "bags, wallets, watches, belts and fashion accessory brands" },
  { name: "jewellery", about: "gold, silver, diamond and fashion jewellery brands and marketplaces" },
  { name: "eyewear", about: "glasses, contact lenses and eye-test brands" },
  { name: "kids fashion and products", about: "children's clothing, toys, baby products and kids brands" },

  // Beauty and personal care
  { name: "skincare and makeup brands", about: "own-brand skincare, cosmetics and makeup" },
  { name: "haircare and men's grooming", about: "shampoo, hair products, beard care, razors and men's grooming brands" },
  { name: "salon and spa", about: "salon chains, spas, at-home salon and beauty services" },

  // Shopping
  { name: "home and kitchen brands", about: "own-brand cookware, appliances, home goods" },
  { name: "mattress and sleep brands", about: "mattresses, pillows and sleep products sold online" },
  { name: "furniture and home décor", about: "selling or renting furniture, home décor" },
  { name: "D2C consumer brands", about: "other own-brand products sold online that fit nowhere else" },
  { name: "gifting", about: "online gifts, flowers, cakes, personalised gifts, corporate gifting" },
  { name: "general e-commerce", about: "online marketplaces selling many kinds of products" },
  { name: "social commerce", about: "reselling through WhatsApp/social media, group buying, community buying (Meesho)" },
  { name: "second-hand and refurbished", about: "used phones, electronics, furniture and other resale marketplaces" },
  { name: "kirana and local store tech", about: "apps and software that help kirana and neighbourhood shops sell online or manage stock" },
  { name: "gadgets and electronics brands", about: "consumer electronics, audio, wearables, smart devices" },

  // Home and property
  { name: "home services", about: "booking plumbers, cleaners, electricians, repairs" },
  { name: "laundry", about: "on-demand laundry, ironing and dry-cleaning pickup" },
  { name: "interior design", about: "home interiors, modular kitchens, renovation services" },
  { name: "real estate and rentals", about: "property listings, home buying, brokerage-free renting" },
  { name: "construction and building materials", about: "construction services, building material marketplaces, contractors" },
  { name: "co-living and hostels", about: "managed shared housing, student housing, PGs, hostels" },
  { name: "co-working", about: "shared office spaces" },

  // Travel and events
  { name: "hotels and stays", about: "hotel chains, budget hotel networks, homestays, holiday rentals" },
  { name: "travel booking and trips", about: "flight, bus and train booking, trip planning, tour packages" },
  { name: "event ticketing", about: "event discovery, concert, movie and show ticket booking" },
  { name: "wedding services", about: "wedding planning, venues, vendors, wedding marketplaces" },
  { name: "sports and fitness venues", about: "sports turfs, venue booking, sports academies and leagues" },

  // Media and entertainment
  { name: "social networks", about: "social networking and community apps" },
  { name: "short video and creators", about: "short video apps, creator and influencer platforms" },
  { name: "news and media", about: "digital news, newsletters, media brands" },
  { name: "streaming and OTT", about: "video streaming and OTT platforms" },
  { name: "music, podcasts and audio", about: "music streaming, podcasts, audio books and audio apps" },
  { name: "dating and matrimony", about: "dating apps and matrimony sites" },
  { name: "gaming", about: "mobile games, casual games, esports" },
  { name: "fantasy sports and real-money gaming", about: "fantasy sports, rummy, poker and other real-money games" },
  { name: "astrology and spiritual", about: "astrology, horoscope, devotional, puja and temple booking apps" },

  // Money
  { name: "payments", about: "wallets, UPI apps, payment gateways, payment devices for shops" },
  { name: "lending", about: "digital loans, buy-now-pay-later, microfinance apps" },
  { name: "credit cards", about: "credit card startups and card-based fintech" },
  { name: "digital banking", about: "app-only banks and banking apps for people or small businesses" },
  { name: "investing and trading", about: "stock trading, mutual funds, wealth management apps" },
  { name: "personal finance and tax", about: "budgeting, tax filing, credit score and money management apps" },
  { name: "crypto and web3", about: "crypto exchanges, NFTs, blockchain products" },
  { name: "insurance", about: "buying insurance online, insurance-tech" },
  { name: "cross-border payments", about: "remittances, international transfers, foreign exchange" },

  // Business and B2B
  { name: "B2B supply for shops", about: "wholesale supply to kiranas, retailers and restaurants" },
  { name: "B2B industrial marketplaces", about: "raw materials, industrial goods and manufacturing marketplaces" },
  { name: "manufacturing", about: "contract manufacturing, factories and hardware production startups" },
  { name: "agritech", about: "services for farmers, farm inputs, farm-to-market supply" },
  { name: "jobs and hiring", about: "job portals, gig work, recruitment" },
  { name: "software for small businesses", about: "billing, accounting, inventory, bookkeeping, CRM apps for small businesses" },
  { name: "restaurant software", about: "POS, ordering, billing and management software for restaurants" },
  { name: "HR and payroll software", about: "HR, payroll, attendance and employee software for companies" },
  { name: "sales and marketing software", about: "CRM, marketing, customer support software for companies" },
  { name: "developer and IT tools", about: "software for developers, cloud, security and IT teams" },
  { name: "business software", about: "other software sold to companies that fits nowhere else" },
  { name: "AI apps and tools", about: "products built mainly around AI: chatbots, AI assistants, AI writing/image/video tools" },
  { name: "marketing and creative agencies", about: "digital marketing, design, content and advertising agencies" },
  { name: "legal and government services", about: "legal help, company registration, GST and tax filing, document services" },

  // Climate
  { name: "solar and clean energy", about: "rooftop solar, clean energy, energy saving products" },
  { name: "recycling and waste", about: "recycling, scrap collection, waste management" },

  // Other
  { name: "pet care", about: "pet food, vets, grooming, pet products" },
  { name: "parenting and childcare", about: "daycare, nannies, parenting apps and childcare services" },
  { name: "other", about: "only if nothing above fits at all" },
];
