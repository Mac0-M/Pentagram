document.addEventListener("DOMContentLoaded", function() {
    fetch("../HTML/header.html")
        .then(response => response.text())
        .then(data => {
            const placeholder = document.getElementById("navigation-placeholder");
            if(placeholder) {
                placeholder.innerHTML = data;
                highlightActive();
            }
        });
});

function highlightActive() {
    const page = window.location.pathname.toLowerCase();
    const items = [
        { file: 'feeds.html', ids: ['nav-home-d', 'nav-home-m'] },
        { file: 'dashboard.html', ids: ['nav-dash-d', 'nav-dash-m'] },
        { file: 'create-post.html', ids: ['nav-create-d', 'nav-create-m'] },
        { file: 'profile.html', ids: ['nav-profile-d', 'nav-profile-m'] }
    ];

    if (page.includes('favorite') || page.includes('fav-post')) {
        ['nav-stats-d', 'nav-stats-m', 'nav-fav-post-d', 'nav-favpost-m'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('active');
        });
        return;
    }

    items.forEach(item => {
        if (page.includes(item.file)) {
            item.ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.add("active");
            });
        }
    });
}