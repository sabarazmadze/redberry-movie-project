// GET /filter-options იტვირთება ერთხელ და ქეშდება. დარბაზები, ფორმატები, ენები, დღის მონაკვეთები,
// სორტირება, ბილეთის ტიპები, ადგილების ლიმიტი და დაჯავშნის ხანგრძლივობა აქედან მოდის - UI-ში არაფერია ხელით გაწერილი.
import { api } from './api.js';

// promise - მიმდინარე მოთხოვნა (რომ პარალელურად ორჯერ არ გაიგზავნოს); cached - უკვე მიღებული შედეგი
let promise = null;
let cached = null;

// აბრუნებს პარამეტრებს: ქეშიდან დაუყოვნებლივ, სხვა შემთხვევაში იტვირთება API-დან
export function getOptions() {
  if (cached) return Promise.resolve(cached);
  if (!promise) {
    promise = api.filterOptions()
      .then((data) => { cached = data; return data; })
      .catch((e) => { promise = null; throw e; }); // წარუმატებლობის შემდეგ ხელახლა ცდის საშუალებას ვტოვებთ
  }
  return promise;
}
// სინქრონული წვდომა (null, თუ ჯერ არ ჩატვირთულა)
export const optionsSync = () => cached;
