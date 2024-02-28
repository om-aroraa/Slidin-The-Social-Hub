document.addEventListener("DOMContentLoaded", function() {
    const searchContainer = document.getElementById("searchContainer");
    const searchIcon = document.getElementById("searchIcon");
    const searchText = document.getElementById("searchText");
    const sidebar2 = document.getElementById("sidebar2");

    searchContainer.addEventListener("click", function() {
        // Toggle visibility of span-text-nav and show/hide sidebar2
        searchText.classList.toggle("hidden");
        sidebar2.classList.toggle("active");
    });
});
