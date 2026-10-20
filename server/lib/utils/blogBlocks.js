// Accented letters keep their base letter ("Café" becomes "cafe"); every other
// run of non-alphanumerics collapses to a single dash.
export const slugify = (title) =>
  title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
