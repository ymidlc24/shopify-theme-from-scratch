document.addEventListener("change", (event) => {
  // Check if the change happened inside your filter form
  const filterForm = event.target.closest("#FacetFiltersForm");
  const container = document.querySelector("#ProductGridContainer");

  if (!filterForm || !container) return;

  const formData = new FormData(filterForm);
  const searchParams = new URLSearchParams(formData).toString();
  const url = `${window.location.pathname}?${searchParams}`;

  container.style.opacity = "0.5";

  fetch(url)
    .then((response) => response.text())
    .then((responseText) => {
      const html = new DOMParser().parseFromString(responseText, "text/html");
      const newGrid = html.querySelector("#ProductGridContainer").innerHTML;

      // Update the grid
      container.innerHTML = newGrid;
      container.style.opacity = "1";

      // Update the URL
      history.pushState({ url }, "", url);
    })
    .catch((e) => {
      console.error("Filter Error:", e);
      container.style.opacity = "1";
    });
});
