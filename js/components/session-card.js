import { h, icon } from '../dom.js';
import { price } from '../format.js';
import { isAgeBlocked, ageBlockMessage } from '../auth.js';

/** ჯავშნის მოდალის კოდი იტვირთება მხოლოდ საჭიროებისას (დინამიური import). */
export async function startBooking(session, movie) {
  const mod = await import('../modals/booking.js');
  mod.openBooking(session, movie);
}

/** სეანსის ბარათი სეანსების გვერდზე (დრო, ფორმატი, ენა, დარჩენილი ადგილები, დარბაზი, ფასი). */
export function sessionCard(session, movie) {
  // ბარათი გათიშულია, თუ სეანსი გაყიდულია ან მომხმარებელი ასაკით ვერ აკმაყოფილებს შეზღუდვას
  const blocked = isAgeBlocked(movie);
  const soldOut = session.isSoldOut;
  const disabled = soldOut || blocked;
  // 5 ან ნაკლები ადგილი -> წითელი ინდიკატორი
  const low = !soldOut && session.seatsLeft <= 5;
  const btn = h('button', {
    type: 'button', class: `session-card${soldOut ? ' is-soldout' : ''}${blocked ? ' is-blocked' : ''}`,
    disabled: disabled, title: blocked ? ageBlockMessage(movie) : soldOut ? 'Sold out' : 'Select seats',
    'aria-label': `${session.time}, ${session.format.name}, ${session.venue.name} Hall ${session.hall.name}, ${soldOut ? 'sold out' : session.seatsLeft + ' seats left'}`,
    onclick: () => startBooking(session, movie),
  },
    h('div', { class: 'sc-top' }, h('strong', { class: 'sc-time' }, session.time), h('span', { class: 'badge badge-dark' }, session.format.name)),
    h('div', { class: 'sc-mid' }, h('span', { class: 'muted' }, session.language.name),
      soldOut ? h('span', { class: 'muted' }, 'Sold out') : h('span', { class: `sc-left${low ? ' is-low' : ''}` }, icon('ticket', 12), `${session.seatsLeft} left`)),
    h('div', { class: 'sc-bot' }, h('span', { class: 'sc-venue' }, `${session.venue.name} · Hall ${session.hall.name}`), h('strong', null, price(session.price))));
  return btn;
}
