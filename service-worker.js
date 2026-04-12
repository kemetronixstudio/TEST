const CACHE = 'kg-english-v-clean-audit-4';
const ASSETS = [
  "./index.html",
  "./kg1.html",
  "./kg2.html",
  "./class.html",
  "./certificate.html",
  "./admin.html",
  "./play.html",
  "./homework.html",
  "./parent.html",
  "./style.css",
  "./remove-empty-box.css",
  "./manifest.json",
  "./js/app-core.js",
  "./js/admin-extra.js",
  "./js/play-main.js",
  "./js/class-page.js",
  "./js/certificate-note.js",
  "./student-cloud-client.js",
  "./homework.js",
  "./parent.js",
  "./assets/icons/dreamers-192.png",
  "./assets/icons/dreamers-192-maskable.png",
  "./assets/icons/dreamers-512.png",
  "./assets/icons/dreamers-512-maskable.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/img/dreamers-logo.png",
  "./assets/grades/play-dr-tarek.png",
  "./assets/grades/homework.png",
  "./assets/grades/kg1.png",
  "./assets/grades/kg2.png",
  "./svg/school.png",
  "./svg/alligator.png",
  "./svg/apple.png",
  "./svg/apricot.png",
  "./svg/ball.png",
  "./svg/book.png",
  "./svg/carrots.png",
  "./svg/cat.png",
  "./svg/chicken.png",
  "./svg/cucumbers.png",
  "./svg/dog.png",
  "./svg/food.png",
  "./svg/happy.png",
  "./svg/head.png",
  "./svg/healthy.png",
  "./svg/hippo.png",
  "./svg/meat.png",
  "./svg/orange.png",
  "./svg/please.png",
  "./svg/sad.png",
  "./svg/school-bag.png",
  "./svg/seat.png",
  "./svg/tooth.png",
  "./svg/triangle.png",
  "./svg/truck.png",
  "./svg/wash.png",
  "./assets/quiz-bulk/g1_airplane.png",
  "./assets/quiz-bulk/g1_apple_seeds.png",
  "./assets/quiz-bulk/g1_cat_mammal.png",
  "./assets/quiz-bulk/g1_cow.png",
  "./assets/quiz-bulk/g1_ice.png",
  "./assets/quiz-bulk/g1_math_2plus3.png",
  "./assets/quiz-bulk/g1_math_7minus4.png",
  "./assets/quiz-bulk/g1_plant.png",
  "./assets/quiz-bulk/g1_scissors.png",
  "./assets/quiz-bulk/g1_spider.png",
  "./assets/quiz-bulk/g1_square.png",
  "./assets/quiz-bulk/g1_winter.png",
  "./assets/quiz-bulk/g2_bear.png",
  "./assets/quiz-bulk/g2_butterfly.png",
  "./assets/quiz-bulk/g2_cold_hot.png",
  "./assets/quiz-bulk/g2_earth.png",
  "./assets/quiz-bulk/g2_heart.png",
  "./assets/quiz-bulk/g2_hexagon.png",
  "./assets/quiz-bulk/g2_lizard.png",
  "./assets/quiz-bulk/g2_math_15div3.png",
  "./assets/quiz-bulk/g2_math_4x2.png",
  "./assets/quiz-bulk/g2_pacific.png",
  "./assets/quiz-bulk/g2_roots.png",
  "./assets/quiz-bulk/g2_ruler.png",
  "./assets/quiz-bulk/g3_asia.png",
  "./assets/quiz-bulk/g3_cairo.png",
  "./assets/quiz-bulk/g3_cheetah.png",
  "./assets/quiz-bulk/g3_gas.png",
  "./assets/quiz-bulk/g3_herbivore.png",
  "./assets/quiz-bulk/g3_leaf.png",
  "./assets/quiz-bulk/g3_math_12x7.png",
  "./assets/quiz-bulk/g3_math_256plus348.png",
  "./assets/quiz-bulk/g3_oxygen.png",
  "./assets/quiz-bulk/g3_perimeter.png",
  "./assets/quiz-bulk/g3_right_angle.png",
  "./assets/quiz-bulk/g3_summer.png",
  "./assets/quiz-bulk/g4_area_6x4.png",
  "./assets/quiz-bulk/g4_blood_cells.png",
  "./assets/quiz-bulk/g4_blue_whale.png",
  "./assets/quiz-bulk/g4_earth_layers.png",
  "./assets/quiz-bulk/g4_evaporation.png",
  "./assets/quiz-bulk/g4_fraction_3_4.png",
  "./assets/quiz-bulk/g4_gravity.png",
  "./assets/quiz-bulk/g4_jupiter.png",
  "./assets/quiz-bulk/g4_math_1250div25.png",
  "./assets/quiz-bulk/g4_percent_25.png",
  "./assets/quiz-bulk/g4_solar.png",
  "./assets/quiz-bulk/g4_triangle_degrees.png",
  "./assets/quiz-bulk/g5_africa.png",
  "./assets/quiz-bulk/g5_cube_volume.png",
  "./assets/quiz-bulk/g5_fraction_day.png",
  "./assets/quiz-bulk/g5_gcf_12_18.png",
  "./assets/quiz-bulk/g5_lcm_4_6.png",
  "./assets/quiz-bulk/g5_lungs.png",
  "./assets/quiz-bulk/g5_photosynthesis.png",
  "./assets/quiz-bulk/g5_power_2_3.png",
  "./assets/quiz-bulk/g5_saturn.png",
  "./assets/quiz-bulk/g5_skin.png",
  "./assets/quiz-bulk/g5_speed_light.png",
  "./assets/quiz-bulk/g5_water_formula.png",
  "./assets/quiz-bulk/g6_circle_area.png",
  "./assets/quiz-bulk/g6_dna.png",
  "./assets/quiz-bulk/g6_igneous_rock.png",
  "./assets/quiz-bulk/g6_integers.png",
  "./assets/quiz-bulk/g6_mean.png",
  "./assets/quiz-bulk/g6_mitochondria.png",
  "./assets/quiz-bulk/g6_newton.png",
  "./assets/quiz-bulk/g6_percent15.png",
  "./assets/quiz-bulk/g6_prime.png",
  "./assets/quiz-bulk/g6_pythagorean.png",
  "./assets/quiz-bulk/g6_ratio.png",
  "./assets/quiz-bulk/g6_skeleton.png",
  "./assets/quiz-bulk/kg1_apple.png",
  "./assets/quiz-bulk/kg1_banana.png",
  "./assets/quiz-bulk/kg1_blue.png",
  "./assets/quiz-bulk/kg1_car.png",
  "./assets/quiz-bulk/kg1_cat.png",
  "./assets/quiz-bulk/kg1_circle.png",
  "./assets/quiz-bulk/kg1_hand.png",
  "./assets/quiz-bulk/kg1_number3.png",
  "./assets/quiz-bulk/kg1_number5.png",
  "./assets/quiz-bulk/kg1_rabbit.png",
  "./assets/quiz-bulk/kg1_red.png",
  "./assets/quiz-bulk/kg1_square.png",
  "./assets/quiz-bulk/kg2_apples2.png",
  "./assets/quiz-bulk/kg2_bird.png",
  "./assets/quiz-bulk/kg2_carrot.png",
  "./assets/quiz-bulk/kg2_cucumber.png",
  "./assets/quiz-bulk/kg2_frog.png",
  "./assets/quiz-bulk/kg2_letterB.png",
  "./assets/quiz-bulk/kg2_pencil.png",
  "./assets/quiz-bulk/kg2_shark.png",
  "./assets/quiz-bulk/kg2_sky.png",
  "./assets/quiz-bulk/kg2_stars4.png",
  "./assets/quiz-bulk/kg2_triangle.png",
  "./assets/quiz-bulk/kg2_yellowfruit.png",
];
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const results = await Promise.allSettled(ASSETS.map(async (asset) => {
      try {
        await cache.add(asset);
        return { asset, ok:true };
      } catch (error) {
        console.warn('[sw] Failed to cache asset:', asset, error && error.message ? error.message : error);
        return { asset, ok:false };
      }
    }));
    const failed = results.filter((row) => row.status === 'fulfilled' && row.value && row.value.ok === false);
    if (failed.length) console.warn('[sw] Some assets were not cached during install:', failed.map((row) => row.value.asset));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const networkFirst = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('.json');
  if (networkFirst) {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    const copy = res.clone();
    caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
    return res;
  })));
});
