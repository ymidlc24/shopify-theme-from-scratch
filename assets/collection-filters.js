document.addEventListener('DOMContentLoaded', () => {
  const filterForm = document.querySelector('#FacetFiltersForm');
  const sectionContainer = document.querySelector('#MainCollectionSection');

  if (!filterForm || !sectionContainer) return;

  const updateProducts = () => {
    const formData = new FormData(filterForm);
    const searchParams = new URLSearchParams(formData).toString();
    
    const sectionId = sectionContainer.closest('.shopify-section').id.replace('shopify-section-', '');
    const url = `${window.location.pathname}?section_id=${sectionId}&${searchParams}`;

    const productGrid = document.querySelector('#ProductGridContainer');
    productGrid.style.opacity = '0.5';
    productGrid.style.pointerEvents = 'none';

    fetch(url)
      .then(response => response.text())
      .then(responseText => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        
        document.querySelector('#ProductGridContainer').innerHTML = html.querySelector('#ProductGridContainer').innerHTML;
        document.querySelector('#FacetFiltersForm').innerHTML = html.querySelector('#FacetFiltersForm').innerHTML;
        
        productGrid.style.opacity = '1';
        productGrid.style.pointerEvents = 'auto';

        window.history.pushState({ path: url }, '', `${window.location.pathname}?${searchParams}`);
      })
      .catch(err => {
        console.error('Filter Error:', err);
        productGrid.style.opacity = '1';
      });
  };

  filterForm.addEventListener('change', updateProducts);
  
  let timer;
  filterForm.addEventListener('input', (e) => {
    if (e.target.type === 'number') {
      clearTimeout(timer);
      timer = setTimeout(updateProducts, 700);
    }
  });
});