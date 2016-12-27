/*
* Global variables. Will make this more object based soon.
*/
var subreddit = 'aww';
// Main URL for image feed
var baseURL = 'https://www.reddit.com/r/' + subreddit + '.json';

// Where we're up to, page 1 is 0, page 2 is 25, page 3 is 50.
var count = 0;

// The current url starts off as the base URL, then changes
var currentURL = baseURL;

// Debounce the scroll function
var debounceTimer = null;
var debounceDelay = 100;

// start
fetchReddit(currentURL);

/*
* Initiate our Reddit request
*/
function fetchReddit(currentURL) {
    console.log(currentURL);
    fetch(currentURL).then(function(response) {
        var contentType = response.headers.get("content-type");
        if(contentType && contentType.indexOf("application/json") !== -1) {
            return response.json().then(redditLoaded);
        } else {
            // probably a bad subreddit
            console.log("json failed to load");
        }
    });
}

/*
* When our JSON successfully loads parse it and render images on the page.
*/
function redditLoaded(json) {
    console.log(json);
    count += 25;
    currentURL = baseURL + '?count=' + count + '&after=' + json.data.after;
    var output = document.getElementById("output");
    var len = json.data.children.length;
    var str = '';
    var row, container, image;
    for (var i = 1; i < len; i++) {
        if ((i - 1) % 6 === 0) {
            // starting a row
            if (row) output.appendChild(row);
            row = document.createElement('div');
            row.className = 'row';
        }

        // Create the image container
        if (!json.data.children[i].data.preview) continue;
        var width = json.data.children[i].data.preview.images[0].source.width;
        var height = json.data.children[i].data.preview.images[0].source.height;
        var aspect = width / height;
        
        
        container = document.createElement('div');
        container.className = 'image-container';
        container.style.flex = aspect;

        // Create the image with thumbnail
        image = new Image();
        var thumbnail = json.data.children[i].data.preview.images[0].resolutions[0].url
        thumbnail = thumbnail.split('&amp;').join('&');
        image.src = thumbnail;
        image.className = 'img-loading';
        
        // when it loads change the src to the bigger one
        image.onload = (function(index, image) {
            return function() {
                imageLoad(image, json.data.children[index].data.preview.images[0].source.url);
            }
        })(i, image);

        // if it fails to load delete the element
        image.onerror = imageFail;

        // append to dom as we go
        container.appendChild(image);
        row.appendChild(container);
    }
    document.addEventListener('scroll', scrollLoad);
    document.getElementById('img-loading-message').style.display = 'none';
}

/*
* Could bring in Lodash, or just do it the easy way.
*/
function scrollLoad(event) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function() {
        console.log('scroll');
        if (document.body.scrollHeight == document.body.scrollTop + window.innerHeight) {
            document.removeEventListener('scroll', scrollLoad);
            fetchReddit(currentURL);
            console.log('fired bottom');
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

/*
* When the thumbnail loads change it's source to the larger image.
* This will cause a network request to start and the user can view the
* blurry thumbnail until it's done.
*/
function imageLoad(img, large) {
    console.log(large);
    large = large.split('&amp;').join('&');
    img.src = large;
    img.onload = function() {
        this.className = 'img-zoom';
    }
}