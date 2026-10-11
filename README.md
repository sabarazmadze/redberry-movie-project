# Kino XII

Cinema ticketing front end for the Kino XII network (Redberry Bootcamp XII).
Plain JavaScript (ES modules), **no build step, no dependencies** — any static host works.

API: `https://api.kinoxii.redberryinternship.ge/api` (docs: `/docs`).

## Run locally
```bash
npx serve -s .        # -s = SPA fallback so /sessions, /movies/:slug, /profile reload correctly
# or: python3 -m http.server   (deep links need a fallback to index.html, so prefer the line above)
```

## Deploy
* **Netlify / Cloudflare Pages**: drag-and-drop the folder or connect the repo. `_redirects` and `netlify.toml`
  already contain the SPA rewrite (`/* -> /index.html 200`). Publish directory: `.`
* Must be served from the **domain root** (asset paths are absolute: `/css/...`, `/js/...`).

## Structure
```
index.html            app shell
css/                  tokens (Figma variables), base, components, modal, pages, booking
js/api.js             fetch wrapper: bearer token, ApiError, 401 -> login -> replay
js/auth.js            session state (user, subscribe, age helpers)
js/router.js          History API router (query-only changes call page.update())
js/meta.js            GET /filter-options, fetched once and cached
js/components/        modal manager, validated fields, toasts, cards, search typeahead, navbar
js/modals/            auth (login/sign up), booking (2-step purchase)
js/pages/             home, sessions, movie, profile (+ My Tickets), not-found
```

## Decisions worth knowing
* **Nothing the API owns is hardcoded**: venues, formats, languages, time bands, sorts, ticket types and ratios,
  the 3-seat cap and the 8-minute hold all come from `/filter-options`. The seat map is drawn purely from `/sessions/{id}/seats`
  (sections → rows → seats, `aisleAfter` spacers, `unavailable` gaps, `isMine` restore).
* **401 anywhere** (expired token) opens the login modal and the interrupted request is replayed after sign-in,
  so the user never clicks twice. Same for guests clicking *Select seats*, *Notify me*, etc.
* **409** (seats taken): the contested codes are named, shown as sold, removed from the selection, survivors kept, map refetched.
* **422**: `errors` → mapped onto each field; message-only 422 (rule / expired hold) is shown as written by the API.
* **Countdown** ticks against the absolute `expiresAt`; at zero the modal resets to step 1 with the expiry message.
* **After a mutation** (refund, profile save, order) the UI renders the server's response, not a local guess.
* **Sessions URL state**: `/sessions?venue=galleria,batumi&date=2026-11-14&format=max&language=…&time=…&sort=price_asc&page=2`.
  Any filter/sort change resets `page` to 1; Back/Forward/refresh/copy-link restore the same view; venue selection narrows formats.
* The Figma frames are 1728px wide, the brief says 1920×1080 — the layout is fluid and checked at both widths.


# Kino XII

კინოთეატრების ქსელის (Redberry Bootcamp XII) ბილეთების დაჯავშნის ფრონტენდი.
სუფთა JavaScript (ES modules), არ საჭიროებს აწყობის ეტაპს (build step) და არ აქვს დენდენსიები — მუშაობს ნებისმიერ სტატიკურ ჰოსტზე.

API: https://api.kinoxii.redberryinternship.ge/api (დოკუმენტაცია: /docs).

## ადგილობრივად გაშვება (Run locally)

npx serve -s .      # -s = SPA fallback, რათა /sessions, /movies/:slug, /profile სწორად ჩაიტვირთოს

# ან: python3 -m http.server   (დიდი ლინკებისთვის სასურველია ზემოთ მოცემული ბრძანება, რადგან index.html-ზე გადამისამართებაა საჭირო)

## დეპლოი (Deploy)

- Netlify / Cloudflare Pages: გადაათრიეთ და ჩააგდეთ (drag-and-drop) საქაღალდე ან დააკავშირეთ რეპოზიტორი. ფაილები _redirects და netlify.toml

  უკვე შეიცავს SPA გადაწერის წესებს (/* -> /index.html 200). გამოსაქვეყნებელი საქაღალდე (Publish directory): .

- სერვერიდან უნდა ეშვებოდეს დომენის ძირიდან (domain root) (ასეთების ბილიკები აბსოლუტურია: /css/..., /js/...).


## სტრუქტურა

index.html            აპლიკაციის შელი (app shell)

css/                  ტოკენები (Figma variables), base, components, modal, pages, booking

js/api.js             fetch wrapper: bearer token, ApiError, 401 -> login -> replay

js/auth.js            სესიის მდგომარეობა (user, subscribe, age helpers)

js/router.js          History API router (მხოლოდ query-ცვლილებები უხმობს page.update()-ს)

js/meta.js            GET /filter-options, იტვირთება ერთხელ და ქეშირდება

js/components/        modal manager, validated fields, toasts, cards, search typeahead, navbar

js/modals/            auth (შესვლა/რეგისტრაცია), booking (2-საფეხურიანი ყიდვა)

js/pages/             home, sessions, movie, profile (+ My Tickets), not-found



## მნიშვნელოვანი არქიტექტურული გადაწყვეტილებები

- არაფერია ჰარდკოდირებული, რაც API-ს ეკუთვნის: ლოკაციები, ფორმატები, ენები, დროის ინტერვალები, სორტირება, ბილეთების ტიპები და პროპორციები,

  3-ადგილიანი ლიმიტი და 8-იანი ჯავშნის დრო — ყველაფერი მოდის /filter-options-დან. ადგილების რუკა იხაზება პირდაპირ /sessions/{id}/seats-დან

  (sections → rows → seats, aisleAfter დაშორებები, unavailable ხარვეზები, isMine აღდგენა).

- ნებისმიერი 401 (ვადაგასული ტოკენი) ხსნის ავტორიზაციის ფანჯრას (modal) და შეფერხებული მოთხოვნა ავტომატურად მეორდება სისტემაში შესვლის შემდეგ,

  ისე, რომ მომხმარებელს ორჯერ დაწკაპუნება არ უწევს. იგივე ეხება სტუმრებს, რომლებიც აწკაპუნებენ ღილაკებზე Select seats, Notify me და ა.შ.

- 409 (ადგილები დაკავებულია): კონკრეტული კოდები დასახელებულია, ნაჩვენებია როგორც გაყიდული, ამოღებულია არჩევანიდან, გადარჩენილები შენარჩუნებულია, ხოლო რუკა თავიდან არის გამოთხოვილი.

- 422: errors → მაპირდება თოეულველზე; შეტყობინებაზე დამყარებული 422 (წესი / ვადაგასული ჯავშანი) ნაჩვენებია ზუსტად ისე, როგორც API აბრუნებს.

- აივთვლითი საათი (Countdown) მუშაობს აბსოლუტურ expiresAt-თან მიმართებაში; ნულზე გასვლისას ფანჯარა ბრუნდება 1-ელ საფეხურზე ვადის გასვლის შეტყობინებით.

- მუტაციის შემდეგ (თანხის დაბრუნება, პროფილის შენახვა, შეკვეთა) UI აჩვენებს სერვერის პასუხს და არა ლოკალურ ვარაუდს.

- სესიების URL მდგომარეობა: /sessions?venue=galleria,batumi&date=2026-11-14&format=max&language=…&time=…&sort=price_asc&page=2.

  ნებისმიერი ფილტრის/სორტირების ცვლილება ატრიალებს page-ს 1-ელ გვერდზე; უკან/წინ/განახლება/ლინკის კოპირება აღადგენს ზუსტად იმავე ხედს; ლოკაციის შერჩევა ამცირებს ხელმისაწვდომ ფორმატებს.

- Figma-ს ჩარჩოები (frames) არის 1728px სიგანის, ბრიფში მითითებულია 1920×1080 — დიზაინი არის სითხოვანი (fluid) და შემოწმებულია ორივე სიგანეზე.