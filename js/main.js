"use strict";

var loader = (function () {
    var loadingMessage = document.getElementById("image-loading-message");

    return {
        message (message) {
            loadingMessage.style.display = "block";
            loadingMessage.innerHTML = message;
        },
        hide () {
            loadingMessage.style.display = "none";
        }
    }
})();

function getSearchUrl () {
    var input = document.getElementById("input").value;

    // sub search
    if (document.querySelectorAll("select option")[0].selected === true) {
        // break up the search into an array of subreddits
        var search = input.trim().replace(/\s\s+/g, " ").split(" ").join("");
        return "https://www.reddit.com/r/" + search + ".json" + (imageStore.getNextImages());
    } else {
        // user stuff
        return "https://www.reddit.com/user/" + input + "/submitted.json" + (imageStore.getNextImages());
    }
}

// Initiate our Reddit request
function fetchRedditImages () {
    loader.message("Loading...");
    fetch(getSearchUrl())
        .then(function (response) {
            if (response.status === 302 || response.status === 404) {
                throw new Error();
            }
            var contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json();
            }
            throw new Error();
        })
        .then(function (images) {
            if (images.data.children.length === 0) {
                return loader.message("No Results");
            }
            imageStore.setNextImages(images.data.after);
            imageStore.insertImages(images.data);
            loader.hide()

            // cheap way to see if we filled the current view with images
            // ideally track if all pulled images load, then test height
            setTimeout(function () {
                if (scroller.testHeight()) {
                    fetchRedditImages();
                } else {
                    scroller.enableScroller();
                }
            }, 1000);
        }).catch(function () {
            return loader.message("Something went wrong, try refreshing.");
        });
}

// Takes a string and replaces HTML escaped &
function replaceHTMLEscape (string) {
    return string.split("&amp;").join("&");
}

// When our JSON successfully loads parse it and render images on the page.
var imageStore = (function () {
    var currentRow;
    var imageCounter = 0;
    var imagesPerRow = 4;
    var output = document.getElementById("output");
    var nextImages;

    return {
        clearImages () {
            currentRow = undefined;
            imageCounter = 0;
            nextImages = undefined;
            output.innerHTML = "";
            return true;
        },
        setNextImages (next) {
            nextImages = next;
        },
        getNextImages () {
            return nextImages ? "?after=" + nextImages : "";
        },
        insertImages (data) {
            var container, image, element, sourceImage;
        
            // deal with first case of no row existing
            if (!currentRow) {
                currentRow = document.createElement("div");
                currentRow.className = "row";
                output.appendChild(currentRow);
            }
        
            // for each image
            for (var i = 0; i < data.children.length; i++) {
                if (imageCounter === imagesPerRow) {
                    // starting a row
                    imageCounter = 0;

                    // build a new row
                    currentRow = document.createElement("div");
                    currentRow.className = "row";
                    output.appendChild(currentRow);
                }
        
                element = data.children[i];
        
                // Potentially skip the image
                if (!element.data.preview || element.data.over_18) continue;
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
                image.className = "image-loading";
        
                // Set the large image for our overlay
                if (element.data.url.indexOf(".gifv") > 0) {
                    // it's an imgur gifv image
                    sourceImage = element.data.url.substring(0, element.data.url.length - 1);
                } else {
                    // it's something plain, or gyfcat
                    sourceImage = replaceHTMLEscape(currentImages.source.url);
                }
        
                /*
                * When the thumbnail loads change its source to the larger image.
                * This will cause a network request to start and the user can view the
                * blurry thumbnail until it's done.
                */
                image.onload = (function (img, largeImage) {
                    return function () {
                        img.src = replaceHTMLEscape(largeImage);
                        img.onload = function () {
                            this.className = "";

                            // when the larger version loads, apply the zoom effect
                            this.parentElement.className += " image-zoom";

                            // Clicking the image shows the overlay
                            this.parentElement.onclick = function () {
                                overlay.displayImage(this);
                            }
                        };
                    };
                })(image, largeResolution.url);
        
                // if it fails to load delete the element
                image.onerror = function () {
                    this.outerHTML = "";
                }
        
                // Build the container
                container = document.createElement("div");
                container.className = "image-container";
        
                // let's our images be tiled
                container.style.flex = aspect;
                container.setAttribute("large-image", sourceImage);
                var titleText = element.data.title;
                image.alt = titleText;
                container.setAttribute("title-text", titleText);
                container.setAttribute("author", element.data.author);
                container.appendChild(image);
        
                // Add title overlay to image
                var title = document.createElement("p");
                if (titleText.length > 25) {
                    titleText = titleText.substring(0, 24) + "...";
                }
                title.innerHTML = titleText;
                title.className = "image-title";
        
                // add to dom
                container.appendChild(title);
                currentRow.appendChild(container);
        
                // increment our image counter
                imageCounter++;
            }
        }
    };
})();

var scroller = (function () {
    var debounceTimer = null;

    // have we scrolled to the end of the page?
    function _testHeight () {
        return window.pageYOffset + window.innerHeight >= document.body.scrollHeight;
    }

    // Have scrolled far enough down the page?
    function testScrollHeight () {
        if (_testHeight()) {
            scroller.disableScroller();
            fetchRedditImages();
        }
    }

    function scrollLoad () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(testScrollHeight, 100);
    }

    return {
        enableScroller () {
            document.addEventListener("scroll", scrollLoad);
        },
        disableScroller () {
            document.removeEventListener("scroll", scrollLoad);
        },
        testHeight () {
            return _testHeight();
        }
    }
})();

// direction buttons
var directionals = (function () {
    var currentContainer;

    // they pressed an arrow key maybe
    function directionPress (e) {
        var newElement, newRow, sibling, child;
        var key = e.which || e.keyCode;

        // which key?
        if (key === 37) {
            // hit left
            sibling = "previousSibling";
            child = "lastChild";
        } else if (key === 39) {
            // pressed right
            sibling = "nextSibling";
            child = "firstChild";
        } else {
            // exit early if not one of those
            return;
        }

        newElement = currentContainer[sibling];
        if (newElement) {
            // found next element right away
            currentContainer = newElement;
            overlay.displayImage(currentContainer);
        } else {
            // we need to go up and into the previous row
            newRow = currentContainer.parentElement[sibling];
            if (newRow) {
                currentContainer = newRow[child];
                overlay.displayImage(currentContainer);
            }
        }
    }

    return {
        bindArrowKeys () {
            document.addEventListener("keydown", directionPress);
        },
        unbindArrowKeys () {
            document.removeEventListener("keydown", directionPress);
        },
        setCurrentContainer (container) {
            currentContainer = container;
        }
    }
})();

// our overlay component
var overlay = (function () {
    var userButton = document.getElementById("overlay-user");
    var overlayContainer = document.getElementById("overlay");

    // setup overlay handler for closing
    overlayContainer.onclick = function() {
        this.style.display = "none";

        // let body scroll again
        document.body.style.overflow = "";
        directionals.unbindArrowKeys();
    };

    return {
        // For the overlay element, extract it's data attributes.
        displayImage (imageContainer) {
            // enable arrow navigation
            directionals.bindArrowKeys();
            directionals.setCurrentContainer(imageContainer);

            // display the overlay
            overlayContainer.style.display = "block";

            // set overlay properties
            document.getElementById("overlay-title").innerHTML = imageContainer.getAttribute("title-text");
            document.getElementById("overlay-image").alt = imageContainer.getAttribute("title-text");
            document.getElementById("overlay-image").src = imageContainer.getAttribute("large-image");

            // set author on the overlay button
            var author = imageContainer.getAttribute("author");
            userButton.setAttribute("author", author);
            userButton.innerHTML = "By /user/" + author;

            // don't let body scroll
            document.body.style.overflow = "hidden"; 
        }
    }
})();

// Checks the input field after enter is hit or search button clicked
function validateInputs (inputField) {
    // work out the input value
    var sub = inputField.value;
    if (document.querySelectorAll("select option")[1].selected === true && sub.indexOf(" ") >= 0) {
        inputField.placeholder = "Users can't have spaces.";
        inputField.value = "";
        return false;
    }
    if (sub.length === 0) {
        inputField.placeholder = "Please search for something.";
        return false;
    }
    return true;
}

// apply event listeners
function bindListeners () {
    var inputField = document.getElementById("input");

    // when users type into the search bar again, clear the current search
    inputField.addEventListener("keypress", imageStore.clearImages);

    // clicking the search button
    document.getElementById("input-search").addEventListener("submit", function (e) {
        e.preventDefault();
        validateInputs(inputField) && imageStore.clearImages() && fetchRedditImages();
    });

    // clicking the users name in the overlay for search
    document.getElementById("overlay-user").addEventListener("click", function (e) {
        document.querySelectorAll("select option")[1].selected = true;
        inputField.value = document.getElementById("overlay-user").getAttribute("author");
        imageStore.clearImages();
        fetchRedditImages();
    });
}

// polyfill fetch if required
(function initialise () {
    if (window.fetch) {
        bindListeners();
    } else {
        var fetchPoly = document.createElement("script");
        fetchPoly.src = "https://cdnjs.cloudflare.com/ajax/libs/fetch/2.0.1/fetch.min.js";
        fetchPoly.onload = bindListeners;
        document.head.appendChild(fetchPoly);
    }
})();
