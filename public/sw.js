importScripts('/src/js/idb.js')
importScripts('/src/js/utility.js')
var CACHE_STATIC_NAME = 'static-v7'
var CACHE_DYNAMIC_NAME = 'dynamic'
var STATIC_FILES =['/','/index.html','/offline.html','/src/js/app.js','/src/js/feed.js','/src/js/idb.js',
'/src/js/promise.js','/src/js/fetch.js','/src/js/material.min.js','/src/css/app.css','/src/css/feed.css','/src/images/main-image.jpg',
'https://fonts.googleapis.com/css?family=Roboto:400,700',
'https://fonts.googleapis.com/icon?family=Material+Icons',
'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css'];


// function trimCache(cacheName,maxItems) {
//     caches.open(cacheName)
//         .then(function(cache) {
//             return cache.keys()
//         })
//         .then(function(keys) {
//             if(keys.length > maxItems) {
//                 cache.delete(keys[0])
//                     .then(trimCache(cacheName,maxItems));
//             }
//         })
// }

self.addEventListener('install', function(event){
    console.log('Service Worker Installed!',event)
    event.waitUntil(caches.open(CACHE_STATIC_NAME).then(         //wait until function wait for cache open which is async operation
        function(cache){
            console.log('Pre Caching App shell')
            cache.addAll(['/','/index.html','/offline.html','/src/js/app.js','/src/js/feed.js',
            '/src/js/promise.js','/src/js/fetch.js','/src/js/material.min.js','/src/css/app.css','/src/css/feed.css','/src/images/main-image.jpg',
            'https://fonts.googleapis.com/css?family=Roboto:400,700',
            'https://fonts.googleapis.com/icon?family=Material+Icons',
            'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css'])  // this will make req to file download and store it in cache
        }
    ))                
})


self.addEventListener('activate',function(event){
    console.log('Service Worker Activated',event)
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
          return Promise.all(
            cacheNames.map(function(cacheName) {
                if(cacheName!== CACHE_STATIC_NAME && cacheName!==CACHE_DYNAMIC_NAME){
                    return caches.delete(cacheName);
                }  
            })
          );
        })
      );
    return self.clients.claim();
})

function isInArray(string,array){
    for(var i =0;i< array.length;i++){
        if(array[i] === string){
            return true;
        }
    }
    return false;
}

self.addEventListener('fetch',function(event){
    var url = 'https://insta-8759d-default-rtdb.firebaseio.com/posts';

    //cache then network
    if (event.request.url.indexOf(url) > -1) {
        // event.respondWith(
        //     caches.open(CACHE_DYNAMIC_NAME)
        //         .then(function(cache){
        //             return fetch(event.request)
        //                         .then(function(res){
        //                             // trimCache(CACHE_DYNAMIC_NAME,3);
        //                             cache.put(event.request,res.clone());
        //                             return res;   // res should be returned so that it reaches feed.js file
        //                         })
        //         })
                
        // );
        //store in indexedDB
            event.respondWith(fetch(event.request)
              .then(function (res) {
                var clonedRes = res.clone();
                clearAllData('posts')
                  .then(function () {
                    return clonedRes.json();
                  })
                  .then(function (data) {
                    for (var key in data) {
                      writeData('posts', data[key])
                    }
                  });
                return res;
              })
            );
          }else if(isInArray(event.request.url,STATIC_FILES)){
            //cache only
            event.respondWith(
            caches.match(event.request)
        )
    }
    else{
        //cache fallback to network (with dynamic caching)
        event.respondWith(
            caches.match(event.request)
                .then(function(response){
                    if(response){
                        return response;
                    }else{
                        return fetch(event.request)
                        .then(function(res){
                            caches.open(CACHE_DYNAMIC_NAME)
                                .then(function(cache){
                                    // trimCache(CACHE_DYNAMIC_NAME,3);
                                    cache.put(event.request.url,res.clone());  //we can only use res once so we clone it else it will be empty once used
                                    return res;
                                })
                        })
                    }
                })
                .catch(function(err){
                    return caches.open(CACHE_STATIC_NAME)
                                .then(function(cache){
                                    if(event.request.headers.get('accept').includes('text/html')){
                                        return cache.match('/offline.html')
                                    }
                                })
                })
                
        );      //fetch data from cache if available
    }
      
})



self.addEventListener('sync', function(event) {
    console.log('[Service Worker] Background syncing', event);
    if (event.tag === 'sync-new-posts') {
      console.log('[Service Worker] Syncing new Posts');
      event.waitUntil(
        readAllData('sync-posts')
          .then(function(data) {
            for (var dt of data) {
                var postData = new FormData();
                postData.append('id', dt.id);
                postData.append('title', dt.title);
                postData.append('location', dt.location);
                postData.append('rawLocationLat', dt.rawLocation.lat);
                postData.append('rawLocationLng', dt.rawLocation.lng);
                postData.append('file', dt.picture, dt.id + '.png');
              fetch('https://insta-8759d-default-rtdb.firebaseio.com/posts', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                },
                body: postData
              })
                .then(function(res) {
                  console.log('Sent data', res);
                  if (res.ok) {
                    res.json()
                      .then(function(resData) {
                        deleteItemFromData('sync-posts', resData.id);
                      });
                  }
                })
                .catch(function(err) {
                  console.log('Error while sending data', err);
                });
            }
  
          })
      );
    }
  });


  self.addEventListener('notificationclick', function(event) {
    var notification = event.notification;
    var action = event.action;
  
    console.log(notification);
  
    if (action === 'confirm') {
      console.log('Confirm was chosen');
      notification.close();
    } else {
      console.log(action);
      event.waitUntil(
        clients.matchAll()
          .then(function(clis) {
            var client = clis.find(function(c) {
              return c.visibilityState === 'visible';
            });
  
            if (client !== undefined) {
              client.navigate(notification.data.url);
              client.focus();
            } else {
              clients.openWindow(notification.data.url);
            }
            notification.close();
          })
      );
    }
  });
  
  self.addEventListener('notificationclose', function(event) {
    console.log('Notification was closed', event);
  });

  self.addEventListener('push', function(event) {
    console.log('Push Notification received', event);
  
    var data = {title: 'New!', content: 'Something new happened!', openUrl: '/'};
  
    if (event.data) {
      data = JSON.parse(event.data.text());
    }
  
    var options = {
      body: data.content,
      icon: '/src/images/icons/app-icon-96x96.png',
      badge: '/src/images/icons/app-icon-96x96.png',
      data: {
        url: data.openUrl
      }
    };
  
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  });