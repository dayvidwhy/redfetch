/*
* Global variables. Will make this more object based soon.
*/
var search = 'aww+puppies'; // Keep track of the subreddit we want to scrape for images
var searchArea = 'r'; // Display subreddits first
var baseURL = 'https://www.reddit.com/' + searchArea + '/' + search + '.json'; // Main URL for image feed
var currentURL = baseURL; // The current url starts off as the base URL, then changes
var debounceTimer = null; // Debounce the scroll function
var debounceDelay = 100;

/* 
* Check to see if browser supports fetch.
* If not, polyfill it then start.
*/
function init() {
    if (window.fetch) {
        bindListeners();
    } else {
        var fetchPoly = document.createElement('script');
        fetchPoly.src = 'https://cdnjs.cloudflare.com/ajax/libs/fetch/2.0.1/fetch.min.js';
        fetchPoly.onload = bindListeners;
        document.head.appendChild(fetchPoly);
    }
}

// okgo
init();

/*
* Returns the search URL depending on it we want a user or subreddit.
*/
function createSearchURL(searchArea, sub) {
    var url = 'https://www.reddit.com/' + searchArea + '/' + sub;
    if (searchArea === 'user') url += '/submitted';
    return url + '.json';
}

/*
* Check the input field after enter is hit or search button clicked.
*/
function checkInputs(ele) {
    var searchAreas = ['r', 'user'];

    // set the current search area
    searchArea = searchAreas[document.querySelectorAll('select')[0].selectedIndex];

    // work out the input value
    var sub = ele.value;
    if (searchArea === 'user' && sub.indexOf(' ') > 0) {
        ele.placeholder = 'Users can\'t have spaces';
        ele.value = '';
        return;
    }
    if (sub.length === 0) {
        ele.placeholder = 'Please search for something.';
        return;
    }

    // assign globals
    search = sub = sub.trim().replace(/\s\s+/g, ' ').split(' ').join('+');
    baseURL = currentURL = createSearchURL(searchArea, sub);

    // start search after checks done    
    beginSearch();
}

/*
* Apply event listeners.
*/
function bindListeners() {
    document.getElementById('input').addEventListener('keypress', function (e) {
        this.placeholder = '';
        var key = e.which || e.keyCode;
        if (key === 13) { // listen for enter key
          checkInputs(this);
        }
    });

    document.getElementById('input-search').addEventListener('submit', function (e) {
        e.preventDefault();
        checkInputs(document.getElementById('input'));
    });

    // out overlays image click
    document.getElementById('overlay-user').addEventListener('click', function(e) {
        document.querySelectorAll('select option')[1].selected = true;
        searchArea = 'user';
        search = this.getAttribute('author');
        document.querySelectorAll('input')[0].value = search;
        baseURL = 'https://www.reddit.com/' + searchArea + '/' + search + '/submitted.json';
        currentURL = baseURL;
        beginSearch();
    });

    beginSearch(); // auto search on load
}

/*
* Setup overlay handler and begin searching.
*/
function beginSearch() {
    // setup overlay dismiss
    try {
        document.getElementById('output').innerHTML = '';
        var loading = document.getElementById('img-loading-message');
        loading.style.display = 'block';
        loading.innerHTML = 'Loading...';
        document.getElementById('overlay').onclick = function() {
            this.style.display = 'none';
            document.body.style.overflow = ''; // let body scroll again
        };
        fetchReddit(currentURL);
    } catch(_) { // gotta catch em all. #pokemon-antipattern
        var error = document.createElement('h2');
        error.innerHTML = 'Something went super wrong, try refreshing.';
        document.getElementById("output").appendChild(error);
    }
}

/*
* Initiate our Reddit request
*/
function fetchReddit(currentURL) {
    fetch(currentURL).then(function(response) {
        if (response.status === 302 || response.status === 404) {
            document.getElementById('img-loading-message').innerHTML = 'No Results';
            return;
        }
        var contentType = response.headers.get("content-type");
        if(contentType && contentType.indexOf("application/json") !== -1) {
            return response.json().then(redditLoaded);
        } else {
            // probably a bad subreddit
        }
    });
}

/*
* When our JSON successfully loads parse it and render images on the page.
*/
function redditLoaded(json) {
    currentURL = baseURL + '?after=' + json.data.after;
    var output = document.getElementById("output");
    var len = json.data.children.length;
    if (len === 0) {
        document.getElementById('img-loading-message').innerHTML = 'No Results';
        return;
    }
    var row, container, image, element, sourceImage;
    for (var i = 1; i < len; i++) {
        if ((i - 1) % 4 === 0) {
            // starting a row
            if (row) output.appendChild(row);
            row = document.createElement('div');
            row.className = 'row';
        }

        element = json.data.children[i];

        // Does this element have preview images?
        if (!element.data.preview) continue;
        var currentImages = element.data.preview.images[0];

        // If the resolutions array is empty just skip the image
        if (currentImages.resolutions.length === 0) continue;
        var currentResolutions = currentImages.resolutions;

        // Work out image aspect, pick something from the middle of the array
        var largeResolution = currentResolutions[Math.floor(currentResolutions.length - 1 / 2)];
        var aspect = largeResolution.width / largeResolution.height;

        // Create the image with thumbnail
        image = new Image();
        var thumbnail = replaceHTMLEscape(currentImages.resolutions[0].url);
        image.src = thumbnail;
        image.className = 'img-loading';

        // Set the large image for our overlay
        if (element.data.url.indexOf('.gifv') > 0) {
            // it's an imgur gifv image
            sourceImage = element.data.url.substring(0, element.data.url.length - 1);
        } else {
            // it's something plain, or gyfcat
            sourceImage = replaceHTMLEscape(currentImages.source.url);
        }

        // when it loads change the src to the bigger one
        image.onload = (function(image, largeResolution) {
            return function() {
                imageLoad(image, largeResolution);
            };
        })(image, largeResolution.url);
        // if it fails to load delete the element
        image.onerror = imageFail;

        // Build the container
        container = document.createElement('div');
        container.className = 'image-container';
        // let's our images be tiled
        container.style.flex = aspect;
        container.setAttribute('large-image', sourceImage);
        var titleText = element.data.title;
        image.alt = titleText;
        container.setAttribute('title-text', titleText);
        container.setAttribute('author', element.data.author);
        container.appendChild(image);

        // Add title overlay to image
        var title = document.createElement('p');
        if (titleText.length > 25) {
            titleText = titleText.substring(0, 24) + '...';
        }
        title.innerHTML = titleText;
        title.className = 'img-title';

        // add to dom
        container.appendChild(title);
        row.appendChild(container);
    }
    output.appendChild(row); // append last row
    document.getElementById('img-loading-message').style.display = 'none';
    document.addEventListener('scroll', scrollLoad);

    // is this enough to fill the page? Some sneaky recursion to fill it out. NB: fires too soon
    var headerHeight = document.getElementsByTagName('header')[0].clientHeight;
    var outputHeight = output.clientHeight;
    var bannerHeight = document.querySelector('.banner').clientHeight;
    if ((headerHeight + outputHeight + bannerHeight) < window.innerHeight) {
        fetchReddit(currentURL);
    }
}

/*
* Debounce scroll event.
*/
function scrollLoad(event) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(testScrollHeight, debounceDelay);
}

/*
* Function to see if we have scrolled far enough down the page.
*/
function testScrollHeight() {
    if (document.body.scrollHeight == document.body.scrollTop + window.innerHeight) {
        document.removeEventListener('scroll', scrollLoad);
        fetchReddit(currentURL);
        document.getElementById('img-loading-message').style.display = 'block';
    }
}

/*
* When the image fails to load just delete it from the page.
*/
function imageFail() {
    this.outerHTML = '';
}

/*
* Takes a string and replaces HTML escaped &
*/
function replaceHTMLEscape(string) {
    return string.split('&amp;').join('&');
}

/*
* When the thumbnail loads change it's source to the larger image.
* This will cause a network request to start and the user can view the
* blurry thumbnail until it's done.
*/
function imageLoad(img, large) {
    large = replaceHTMLEscape(large);
    img.src = large;
    img.onload = function() {
        // when the larger version loads, apply the zoom effect
        this.className = '';
        // and enable the overlay click function to container
        this.parentElement.className += ' pointer img-zoom';
        this.parentElement.onclick = containerClick;
    };
}

/*
* When a user clicks on one of the images.
*/
function containerClick() {
    // display the overlay with options
    document.getElementById('overlay').style.display = 'block';
    document.getElementById('overlay-title').innerHTML = this.getAttribute('title-text');
    document.getElementById('overlay-img').alt = this.getAttribute('title-text');
    document.getElementById('overlay-img').src = this.getAttribute('large-image');
    var author = this.getAttribute('author');
    var userButton = document.getElementById('overlay-user');
    userButton.setAttribute('author', author);
    userButton.innerHTML = 'By /user/' + author;
    document.body.style.overflow = 'hidden'; // don't let body scroll
}