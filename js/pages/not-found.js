import { h, icon } from '../dom.js';

// 404 გვერდი: ჩანს, როცა მისამართი არცერთ მარშრუტს არ ემთხვევა
export function mount(root) {
  root.append(h('div', { class: 'page-pad' }, h('div', { class: 'state' },
    h('span', { class: 'ico' }, icon('film', 22)), h('h3', null, 'Page not found'),
    h('p', null, "We couldn't find the page you were looking for."),
    h('a', { class: 'btn btn-red', href: '/' }, 'Back to home'))));
}
