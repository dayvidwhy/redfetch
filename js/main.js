/*
* Global variables. Will make this more object based soon.
*/

// Keep track of the subreddit we want to scrape for images
var subreddit;

// Main URL for image feed
var baseURL;

// The current url starts off as the base URL, then changes
var currentURL;

// Debounce the scroll function
var debounceTimer = null;
var debounceDelay = 100;

// Get things going
document.getElementById('input').addEventListener('keypress', function (e) {
    var key = e.which || e.keyCode;
    if (key === 13) { // listen for enter key
      var sub = this.value.split(' ').join('+');
      subreddit = sub;
      baseURL = 'https://www.reddit.com/r/' + sub + '.json';
      currentURL = baseURL;
      init();
    }
});

/* Start off a new query */
function init() {
    // setup overlay dismiss
    document.getElementById('output').innerHTML = '';
    document.getElementById('img-loading-message').style.display = 'block';
    document.getElementById('overlay').onclick = function() {
        this.style.display = 'none';
        document.body.style.overflow = ''; // let body scroll again
    };
    fetchReddit(currentURL);
}

/*
* Initiate our Reddit request
*/
function fetchReddit(currentURL) {
    fetch(currentURL).then(function(response) {
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
    var str = '';
    var row, container, image;
    for (var i = 1; i < len; i++) {
        if ((i - 1) % 4 === 0) {
            // starting a row
            if (row) output.appendChild(row);
            row = document.createElement('div');
            row.className = 'row';
        }

        /* Create the image container. */
        // Does this element have preview images?
        if (!json.data.children[i].data.preview) continue;
        var currentImages = json.data.children[i].data.preview.images[0];

        // If the resolutions array is empty just skip the image
        if (currentImages.resolutions.length === 0) continue;
        var currentResolutions = currentImages.resolutions;

        // Work out image aspect
        var largeResolution = currentResolutions[Math.floor(currentResolutions.length - 1 / 2)];
        var width = largeResolution.width;
        var height = largeResolution.height;
        var aspect = width / height;
        container = document.createElement('div');
        container.className = 'image-container';
        container.style.flex = aspect;

        // Create the image with thumbnail
        image = new Image();
        var thumbnail = replaceHTMLEscape(currentImages.resolutions[0].url);
        image.src = thumbnail;
        image.className = 'img-loading';
        
        // Set the large image for our overlay
        image.setAttribute('large-image', replaceHTMLEscape(currentImages.source.url));
        
        // when it loads change the src to the bigger one
        image.onload = (function(image, largeResolution) {
            return function() {
                imageLoad(image, largeResolution);
            };
        })(image, largeResolution.url);

        // if it fails to load delete the element
        image.onerror = imageFail;

        // append to dom as we go
        container.appendChild(image);
        row.appendChild(container);
    }
    document.addEventListener('scroll', scrollLoad);
    document.getElementById('img-loading-message').style.display = 'none';

    // is this enough to fill the page? Some sneaky recursion to fill it out.
    var headerHeight = document.getElementsByTagName('header')[0].clientHeight;
    var outputHeight = output.clientHeight;
    var bannerHeight = document.querySelector('.banner').clientHeight;
    if ((headerHeight + outputHeight + bannerHeight) < window.innerHeight) {
        fetchReddit(currentURL);
    }
}

/*
* Could bring in Lodash, or just do it the easy way.
*/
function scrollLoad(event) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
        if (document.body.scrollHeight == document.body.scrollTop + window.innerHeight) {
            document.removeEventListener('scroll', scrollLoad);
            fetchReddit(currentURL);
            document.getElementById('img-loading-message').style.display = 'block';
        }
    }, debounceDelay);
}

/*
* When the image fails to load just delete it from the page.
*/
function imageFail() {
    this.outerHTML = '';
}

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
        this.className = 'img-zoom';
        // and enable the overlay click function
        this.onclick = function() {
            // display the overlay
            document.getElementById('overlay').style.display = 'block';
            document.getElementById('overlay-img').src = this.getAttribute('large-image');
            document.body.style.overflow = 'hidden'; // don't let body scroll
        };
    };
}