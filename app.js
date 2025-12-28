class RedditViewer {
    constructor() {
        this.posts = [];
        this.filteredPosts = [];
        this.currentAfter = null;
        this.currentSubreddits = [];
        this.imagesOnly = true;
        this.videosOnly = true;
        this.currentViewerIndex = -1;
        this.slideshowInterval = null;
        this.slideshowSpeed = 5000; // 5 seconds
        this.isSlideshowPlaying = false;
        this.videoLoopCount = 0;
        this.targetLoopCount = 1; // Auto-advance after 1 play for auto-play mode
        this.currentMediaIsVideo = false;
        this.videoLoopHandler = null;
        this.videoEndedHandler = null;
        this.isShuffled = false;
        this.isAutoPlayMode = false;
        
        // Load saved preferences
        this.loadPreferences();
        
        this.initializeEventListeners();
        this.initializeViewer();
    }

    loadPreferences() {
        try {
            const saved = localStorage.getItem('redditViewerPrefs');
            if (saved) {
                const prefs = JSON.parse(saved);
                
                // Restore subreddits
                if (prefs.subreddits) {
                    document.getElementById('subreddits').value = prefs.subreddits;
                }
                
                // Restore filter settings
                if (prefs.imagesOnly !== undefined) {
                    this.imagesOnly = prefs.imagesOnly;
                    document.getElementById('imagesOnly').checked = prefs.imagesOnly;
                }
                
                if (prefs.videosOnly !== undefined) {
                    this.videosOnly = prefs.videosOnly;
                    document.getElementById('videosOnly').checked = prefs.videosOnly;
                }
                
                // Restore shuffle state
                if (prefs.isShuffled) {
                    this.isShuffled = true;
                    const mixBtn = document.getElementById('mixBtn');
                    mixBtn.classList.add('active');
                    mixBtn.textContent = '🔀 Shuffled';
                }
            }
        } catch (e) {
            console.log('Could not load preferences:', e);
        }
    }

    savePreferences() {
        try {
            const prefs = {
                subreddits: document.getElementById('subreddits').value,
                imagesOnly: this.imagesOnly,
                videosOnly: this.videosOnly,
                isShuffled: this.isShuffled
            };
            localStorage.setItem('redditViewerPrefs', JSON.stringify(prefs));
        } catch (e) {
            console.log('Could not save preferences:', e);
        }
    }

    clearPreferences() {
        try {
            localStorage.removeItem('redditViewerPrefs');
            document.getElementById('subreddits').value = '';
            this.imagesOnly = true;
            this.videosOnly = true;
            document.getElementById('imagesOnly').checked = true;
            document.getElementById('videosOnly').checked = true;
            this.isShuffled = false;
            const mixBtn = document.getElementById('mixBtn');
            mixBtn.classList.remove('active');
            mixBtn.textContent = '🔀 Mix/Shuffle';
            this.showError('Preferences cleared');
            setTimeout(() => this.hideError(), 2000);
        } catch (e) {
            console.log('Could not clear preferences:', e);
        }
    }

    initializeEventListeners() {
        document.getElementById('loadBtn').addEventListener('click', () => this.loadContent());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearContent());
        document.getElementById('clearMemoryBtn').addEventListener('click', () => this.clearPreferences());
        document.getElementById('loadMoreBtn').addEventListener('click', () => this.loadMore());
        document.getElementById('imagesOnly').addEventListener('change', (e) => {
            this.imagesOnly = e.target.checked;
            this.savePreferences();
            this.filterAndDisplay();
        });
        document.getElementById('videosOnly').addEventListener('change', (e) => {
            this.videosOnly = e.target.checked;
            this.savePreferences();
            this.filterAndDisplay();
        });

        // Load on Enter key and save on change
        const subredditsInput = document.getElementById('subreddits');
        subredditsInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadContent();
            }
        });
        subredditsInput.addEventListener('change', () => {
            this.savePreferences();
        });
        subredditsInput.addEventListener('blur', () => {
            this.savePreferences();
        });

        // Mix/Shuffle button
        document.getElementById('mixBtn').addEventListener('click', () => this.toggleShuffle());
        
        // Auto-Play Mode button
        document.getElementById('autoPlayBtn').addEventListener('click', () => this.startAutoPlayMode());
    }

    initializeViewer() {
        // Close viewer
        document.getElementById('closeViewer').addEventListener('click', () => this.closeViewer());
        document.querySelector('.viewer-overlay').addEventListener('click', () => this.closeViewer());
        
        // Navigation
        document.getElementById('prevBtn').addEventListener('click', () => this.navigateViewer(-1));
        document.getElementById('nextBtn').addEventListener('click', () => this.navigateViewer(1));
        
        // Slideshow controls
        document.getElementById('playPauseBtn').addEventListener('click', () => this.toggleSlideshow());
        document.getElementById('slideshowSpeed').addEventListener('input', (e) => {
            this.slideshowSpeed = e.target.value * 1000;
            document.getElementById('speedLabel').textContent = `${e.target.value}s`;
            if (this.isSlideshowPlaying) {
                this.stopSlideshow();
                this.startSlideshow();
            }
        });
        
        // Fullscreen
        document.getElementById('fullscreenBtn').addEventListener('click', () => this.toggleFullscreen());
        
        // Keyboard navigation (Android TV remote support)
        document.addEventListener('keydown', (e) => {
            if (!document.getElementById('viewerModal').classList.contains('hidden')) {
                if (e.key === 'Escape' || e.key === 'Backspace') {
                    this.closeViewer();
                } else if (e.key === 'ArrowLeft') {
                    this.navigateViewer(-1);
                } else if (e.key === 'ArrowRight') {
                    this.navigateViewer(1);
                } else if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    this.toggleSlideshow();
                }
            } else {
                // Navigation when viewer is closed
                if (e.key === 'Enter' && document.activeElement.id === 'loadBtn') {
                    this.loadContent();
                }
            }
        });
    }

    async loadContent() {
        const subredditsInput = document.getElementById('subreddits').value.trim();
        if (!subredditsInput) {
            this.showError('Please enter at least one subreddit');
            return;
        }

        this.currentSubreddits = subredditsInput.split(',').map(s => s.trim()).filter(s => s);
        this.posts = [];
        this.currentAfter = null;
        
        this.showLoading(true);
        this.hideError();
        document.getElementById('content').innerHTML = '';

        await this.fetchPosts();
    }

    async fetchPosts() {
        try {
            const allPosts = [];
            const errors = [];
            let hasDisplayedInitialContent = false;
            
            // Limit concurrent requests to avoid overwhelming the API (max 5 at a time)
            const MAX_CONCURRENT = 5;
            const subreddits = [...this.currentSubreddits];
            
            // Process subreddits in batches
            for (let i = 0; i < subreddits.length; i += MAX_CONCURRENT) {
                const batch = subreddits.slice(i, i + MAX_CONCURRENT);
                const promises = batch.map(subreddit => 
                    this.fetchSubredditPosts(subreddit)
                );
                
                const results = await Promise.allSettled(promises);
                
                results.forEach((result, batchIndex) => {
                    const subredditIndex = i + batchIndex;
                    if (result.status === 'fulfilled') {
                        if (result.value && result.value.length > 0) {
                            allPosts.push(...result.value);
                        } else {
                            errors.push(`r/${this.currentSubreddits[subredditIndex]} returned no posts`);
                        }
                    } else {
                        const errorMsg = `r/${this.currentSubreddits[subredditIndex]}: ${result.reason?.message || result.reason}`;
                        errors.push(errorMsg);
                        console.error(`Failed to fetch ${this.currentSubreddits[subredditIndex]}:`, result.reason);
                    }
                });
                
                // Display content progressively as it loads
                if (allPosts.length > 0) {
                    // Sort by score
                    const sortedPosts = [...allPosts].sort((a, b) => (b.score || 0) - (a.score || 0));
                    this.posts = [...this.posts, ...sortedPosts];
                    
                    // Filter and display immediately
                    this.filterAndDisplayProgressive(!hasDisplayedInitialContent);
                    hasDisplayedInitialContent = true;
                }
                
                // Small delay between batches to avoid rate limiting
                if (i + MAX_CONCURRENT < subreddits.length) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // Show errors if any, but continue if we have some posts
            if (errors.length > 0 && allPosts.length === 0) {
                this.showError(`Failed to load content: ${errors.join(', ')}`);
            } else if (errors.length > 0) {
                console.warn('Some subreddits failed to load:', errors);
            }

            if (allPosts.length === 0) {
                this.showError('No content found. Please check subreddit names and try again.');
                return;
            }

            // Final sort and display (in case shuffle mode needs full dataset)
            this.posts.sort((a, b) => (b.score || 0) - (a.score || 0));
            this.filterAndDisplay();
            
        } catch (error) {
            console.error('Error fetching posts:', error);
            this.showError(`Failed to load content: ${error.message || 'Unknown error'}. Please check your internet connection and try again.`);
        } finally {
            this.showLoading(false);
        }
    }

    async fetchSubredditPosts(subreddit) {
        try {
            // Clean subreddit name (remove r/ if present)
            const cleanSubreddit = subreddit.replace(/^r\//, '').trim();
            const redditUrl = `https://www.reddit.com/r/${cleanSubreddit}/hot.json?limit=25&raw_json=1${this.currentAfter ? `&after=${this.currentAfter}` : ''}`;
            
            // Use Vercel serverless function as primary proxy (most reliable)
            // Fallback to public proxies if serverless function fails
            const proxies = [
                {
                    url: `/api/proxy?url=${encodeURIComponent(redditUrl)}`,
                    parser: (responseData) => responseData
                },
                {
                    url: `https://corsproxy.io/?${encodeURIComponent(redditUrl)}`,
                    parser: (responseData) => responseData
                },
                {
                    url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(redditUrl)}`,
                    parser: (responseData) => responseData
                }
            ];
            
            let data = null;
            let lastError = null;
            
            for (const proxy of proxies) {
                try {
                    const response = await fetch(proxy.url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                        },
                        mode: 'cors'
                    });
                    
                    if (!response.ok) {
                        continue; // Try next proxy
                    }
                    
                    // Get response as text first to check if it's HTML
                    const responseText = await response.text();
                    
                    // Check if it's HTML error page
                    if (responseText.trim().startsWith('<')) {
                        continue; // HTML response, try next proxy
                    }
                    
                    // Try to parse as JSON
                    let responseData;
                    try {
                        responseData = JSON.parse(responseText);
                    } catch (parseError) {
                        // Not valid JSON, try next proxy
                        continue;
                    }
                    
                    // Parse using proxy-specific parser
                    data = proxy.parser(responseData);
                    
                    // Validate it's Reddit data structure
                    if (data && data.data && data.data.children) {
                        break; // Success!
                    } else {
                        continue; // Wrong structure, try next proxy
                    }
                } catch (err) {
                    lastError = err;
                    continue; // Try next proxy
                }
            }
            
            if (!data || !data.data || !data.data.children) {
                throw new Error(`All proxies failed for r/${cleanSubreddit}${lastError ? ': ' + lastError.message : ''}`);
            }
            
            if (this.currentAfter === null) {
                // Only update after token on first load
                this.currentAfter = data.data.after;
            }
            
            return data.data.children.map(child => child.data);
        } catch (error) {
            console.error(`Error fetching r/${subreddit}:`, error);
            // Return empty array instead of throwing to allow other subreddits to load
            return [];
        }
    }

    filterAndDisplay(forceFullRefresh = false) {
        // Use requestAnimationFrame for smoother UI updates
        requestAnimationFrame(() => {
            const filtered = this.posts.filter(post => {
                const hasImage = this.isImage(post.url) || this.isGif(post.url);
                const hasVideo = this.isVideo(post) || this.isRedditVideo(post);
                
                if (this.imagesOnly && this.videosOnly) {
                    return hasImage || hasVideo;
                } else if (this.imagesOnly) {
                    return hasImage;
                } else if (this.videosOnly) {
                    return hasVideo;
                }
                return true;
            });

            // Shuffle if mix mode is enabled
            // For shuffle mode, we need the full dataset, so only shuffle on final display
            if (this.isShuffled && forceFullRefresh) {
                this.shuffleArray(filtered);
            }

            this.filteredPosts = filtered;
            this.displayPosts(filtered, !forceFullRefresh);
        });
    }

    filterAndDisplayProgressive(isInitial = false) {
        // Progressive display - show content as it loads
        requestAnimationFrame(() => {
            const filtered = this.posts.filter(post => {
                if (!post || !post.url) return false;
                
                const hasImage = this.isImage(post.url) || this.isGif(post.url);
                const hasVideo = this.isVideo(post) || this.isRedditVideo(post);
                
                if (this.imagesOnly && this.videosOnly) {
                    return hasImage || hasVideo;
                } else if (this.imagesOnly) {
                    return hasImage;
                } else if (this.videosOnly) {
                    return hasVideo;
                }
                return true;
            });

            console.log(`Filtered ${filtered.length} media posts from ${this.posts.length} total`);

            // For progressive loading, don't shuffle yet - just show top content first
            // Shuffle will happen on final display
            this.filteredPosts = filtered;
            
            // Display top posts first (sorted by score)
            const sortedFiltered = [...filtered].sort((a, b) => (b.score || 0) - (a.score || 0));
            const topPosts = sortedFiltered.slice(0, Math.min(50, sortedFiltered.length)); // Show first 50
            
            console.log(`Displaying ${topPosts.length} top posts`);
            this.displayPosts(topPosts, true); // Append mode for progressive loading
        });
    }

    shuffleArray(array) {
        // Optimized Fisher-Yates shuffle for large arrays
        // Process in chunks to avoid blocking the UI
        const chunkSize = 1000;
        let currentIndex = array.length;
        
        const shuffleChunk = () => {
            const endIndex = Math.max(0, currentIndex - chunkSize);
            
            while (currentIndex > endIndex) {
                currentIndex--;
                const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
                [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
            }
            
            if (currentIndex > 0) {
                // Continue shuffling next chunk asynchronously
                setTimeout(shuffleChunk, 0);
            }
        };
        
        // If array is small, shuffle synchronously
        if (array.length <= chunkSize) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        } else {
            shuffleChunk();
        }
        
        return array;
    }

    toggleShuffle() {
        this.isShuffled = !this.isShuffled;
        const mixBtn = document.getElementById('mixBtn');
        if (this.isShuffled) {
            mixBtn.classList.add('active');
            mixBtn.textContent = '🔀 Shuffled';
        } else {
            mixBtn.classList.remove('active');
            mixBtn.textContent = '🔀 Mix/Shuffle';
        }
        this.savePreferences();
        // Re-filter and display with new shuffle state
        this.filterAndDisplay();
    }

    startAutoPlayMode() {
        if (this.filteredPosts.length === 0) {
            this.showError('Please load content first');
            return;
        }

        this.isAutoPlayMode = true;
        this.targetLoopCount = 1; // Auto-advance after 1 play
        const autoPlayBtn = document.getElementById('autoPlayBtn');
        autoPlayBtn.classList.add('active');
        autoPlayBtn.textContent = '⏸ Auto-Play Active';

        // Start from first item or random
        const startIndex = this.isShuffled ? Math.floor(Math.random() * this.filteredPosts.length) : 0;
        
        // Open viewer and start slideshow
        this.openViewer(startIndex, true);
        
        // Start slideshow immediately
        this.startSlideshow();
        
        // Auto-enter fullscreen
        setTimeout(() => {
            this.toggleFullscreen();
        }, 500);
    }

    isImage(url) {
        if (!url) return false;
        return /\.(jpg|jpeg|png|webp|bmp)$/i.test(url) || 
               (url.includes('i.redd.it') && !url.includes('.gif')) || 
               (url.includes('i.imgur.com') && !url.includes('.gif'));
    }

    isGif(url) {
        if (!url) return false;
        return /\.gif$/i.test(url) || 
               url.includes('gfycat.com') || 
               url.includes('redgifs.com') ||
               (url.includes('i.redd.it') && url.includes('.gif')) ||
               (url.includes('i.imgur.com') && url.includes('.gif'));
    }

    isVideo(post) {
        if (!post || !post.url) return false;
        return /\.(mp4|webm|mov)$/i.test(post.url) || 
               post.domain === 'v.redd.it' ||
               post.url.includes('v.redd.it') ||
               post.url.includes('youtube.com') ||
               post.url.includes('youtu.be') ||
               (post.is_video === true) ||
               (post.media && post.media.reddit_video);
    }

    isRedditVideo(post) {
        return post && (post.is_video === true || (post.media?.reddit_video?.fallback_url));
    }

    displayPosts(posts, appendMode = false) {
        const contentGrid = document.getElementById('content');
        
        if (posts.length === 0) {
            if (!appendMode) {
                contentGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">No media content found. Try different subreddits or adjust filters.</p>';
            }
            document.getElementById('loadMore').classList.add('hidden');
            return;
        }

        // Clear existing content only if not in append mode
        if (!appendMode) {
            contentGrid.innerHTML = '';
        }

        // Track existing post IDs to avoid duplicates
        const existingIds = new Set();
        if (appendMode) {
            contentGrid.querySelectorAll('.media-card').forEach(card => {
                const postId = card.dataset.postId;
                if (postId) existingIds.add(postId);
            });
        }

        // Add new posts
        posts.forEach(post => {
            // Skip if already displayed (for append mode)
            if (appendMode && existingIds.has(post.id)) {
                return;
            }
            
            const card = this.createMediaCard(post);
            card.dataset.postId = post.id; // Store ID for duplicate checking
            contentGrid.appendChild(card);
            existingIds.add(post.id);
        });

        // Show load more button if we have more content
        if (this.currentAfter) {
            document.getElementById('loadMore').classList.remove('hidden');
        } else {
            document.getElementById('loadMore').classList.add('hidden');
        }
    }

    createMediaCard(post) {
        const card = document.createElement('div');
        card.className = 'media-card';

        const mediaContainer = document.createElement('div');
        mediaContainer.className = 'media-container';

        const mediaUrl = this.getMediaUrl(post);
        const mediaType = this.getMediaType(post);

        if (mediaType === 'video' || mediaType === 'gif') {
            // Use video element for both videos and GIFs (since Reddit serves GIFs as MP4)
            const video = document.createElement('video');
            video.src = mediaUrl;
            video.controls = false; // Hide controls for cleaner look, show on hover
            video.muted = true;
            video.loop = true;
            video.playsInline = true;
            video.preload = 'auto'; // Preload full video for faster display
            
            // Add poster/thumbnail for faster initial display
            const thumbnailUrl = this.getThumbnailUrl(post);
            if (thumbnailUrl) {
                video.poster = thumbnailUrl;
            }
            
            // Error handling
            video.onerror = (() => {
                const postUrl = post.url;
                const postTitle = post.title;
                return function() {
                    console.error('Video/GIF load error:', mediaUrl);
                    // Fallback: try to show as image if video fails
                    const img = document.createElement('img');
                    img.src = postUrl || mediaUrl;
                    img.alt = postTitle;
                    img.onerror = function() {
                        this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%231a1f2e" width="400" height="400"/%3E%3Ctext fill="%23b0b8c4" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EMedia not available%3C/text%3E%3C/svg%3E';
                    };
                    mediaContainer.innerHTML = '';
                    mediaContainer.appendChild(img);
                };
            })();
            
            // Track play state to prevent race conditions
            let isPlaying = false;
            let playPromise = null;
            
            // Auto-play on hover, pause on leave
            card.addEventListener('mouseenter', async () => {
                if (isPlaying) return; // Already playing
                
                try {
                    // Wait for video to be ready
                    if (video.readyState < 2) {
                        await new Promise((resolve) => {
                            video.addEventListener('loadeddata', resolve, { once: true });
                            video.addEventListener('error', resolve, { once: true });
                            // Timeout after 3 seconds
                            setTimeout(resolve, 3000);
                        });
                    }
                    
                    isPlaying = true;
                    playPromise = video.play();
                    await playPromise;
                    video.controls = true;
                } catch (err) {
                    // Ignore AbortError - it's expected when pausing during play
                    // Also ignore NotAllowedError (autoplay policy) - it's normal
                    if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                        console.log('Video/GIF play failed:', err);
                    }
                    isPlaying = false;
                }
            });
            
            card.addEventListener('mouseleave', () => {
                isPlaying = false;
                // Cancel any pending play promise
                if (playPromise) {
                    playPromise.catch(() => {}); // Ignore cancellation errors
                }
                video.pause();
                video.currentTime = 0; // Reset to beginning
                video.controls = false;
            });
            
            mediaContainer.appendChild(video);
        } else {
            const img = document.createElement('img');
            img.src = mediaUrl;
            // Preload GIFs for better hover experience
            img.loading = mediaType === 'gif' ? 'eager' : 'lazy';
            img.alt = post.title;
            
            // For actual GIF images (not MP4), ensure they restart animation on hover
            if (mediaType === 'gif' && /\.gif$/i.test(mediaUrl)) {
                card.addEventListener('mouseenter', () => {
                    // Force reload to restart GIF animation
                    const currentSrc = img.src;
                    img.src = '';
                    // Small delay to ensure reload
                    setTimeout(() => {
                        img.src = currentSrc;
                    }, 10);
                });
            }
            
            img.onerror = function() {
                this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect fill="%231a1f2e" width="400" height="400"/%3E%3Ctext fill="%23b0b8c4" font-family="sans-serif" font-size="18" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EImage not available%3C/text%3E%3C/svg%3E';
            };
            mediaContainer.appendChild(img);
        }

        const badge = document.createElement('div');
        badge.className = 'media-type-badge';
        badge.textContent = mediaType.toUpperCase();
        mediaContainer.appendChild(badge);

        const info = document.createElement('div');
        info.className = 'media-info';

        const title = document.createElement('div');
        title.className = 'media-title';
        title.textContent = post.title;
        info.appendChild(title);

        const meta = document.createElement('div');
        meta.className = 'media-meta';

        const subreddit = document.createElement('span');
        subreddit.className = 'media-subreddit';
        subreddit.textContent = `r/${post.subreddit}`;
        meta.appendChild(subreddit);

        const stats = document.createElement('div');
        stats.className = 'media-stats';
        stats.innerHTML = `
            <span>⬆ ${this.formatNumber(post.ups)}</span>
            <span>💬 ${this.formatNumber(post.num_comments)}</span>
        `;
        meta.appendChild(stats);

        info.appendChild(meta);
        card.appendChild(mediaContainer);
        card.appendChild(info);

        // Open viewer on click instead of redirecting
        card.addEventListener('click', (e) => {
            // Don't trigger if clicking on the card itself during hover
            const index = this.filteredPosts.findIndex(p => p.id === post.id);
            if (index !== -1) {
                this.openViewer(index);
            }
        });

        return card;
    }

    getMediaUrl(post) {
        if (!post) return '';
        
        // Reddit video - check multiple possible locations
        if (post.is_video || post.domain === 'v.redd.it') {
            // Try reddit_video fallback_url first
            if (post.media?.reddit_video?.fallback_url) {
                return post.media.reddit_video.fallback_url;
            }
            // Try secure_media
            if (post.secure_media?.reddit_video?.fallback_url) {
                return post.secure_media.reddit_video.fallback_url;
            }
            // Try crosspost parent
            if (post.crosspost_parent_list?.[0]?.media?.reddit_video?.fallback_url) {
                return post.crosspost_parent_list[0].media.reddit_video.fallback_url;
            }
        }

        // For GIFs that Reddit converted to MP4, check for variants
        if (post.preview?.reddit_video_preview?.fallback_url) {
            return post.preview.reddit_video_preview.fallback_url;
        }

        // For animated GIFs/MP4s, prefer the variants over static preview
        if (post.preview?.images?.[0]?.variants?.mp4?.source?.url) {
            return post.preview.images[0].variants.mp4.source.url.replace(/&amp;/g, '&');
        }
        if (post.preview?.images?.[0]?.variants?.gif?.source?.url) {
            return post.preview.images[0].variants.gif.source.url.replace(/&amp;/g, '&');
        }

        // For direct GIF URLs, use the URL directly
        if (post.url && /\.gif$/i.test(post.url)) {
            return post.url;
        }

        // Preview images (static) - use source or resolutions
        if (post.preview?.images?.[0]?.source?.url) {
            const previewUrl = post.preview.images[0].source.url.replace(/&amp;/g, '&');
            // Don't use preview if we have a direct URL that's better
            if (post.url && !post.url.includes('preview.redd.it')) {
                // Check if direct URL is a media file
                if (/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i.test(post.url)) {
                    return post.url;
                }
            }
            return previewUrl;
        }

        // Direct URL as fallback
        return post.url || '';
    }

    getMediaType(post) {
        if (!post) return 'image';
        
        // Check for Reddit video first
        if (this.isRedditVideo(post)) {
            return 'video';
        }
        
        // Check if URL indicates video
        if (this.isVideo(post)) {
            return 'video';
        }
        
        // Check for GIF variants in preview (Reddit converts GIFs to MP4)
        if (post.preview?.images?.[0]?.variants?.mp4 || post.preview?.images?.[0]?.variants?.gif) {
            return 'gif'; // Treat as GIF even though it might be MP4
        }
        
        // Check if URL is a GIF
        if (this.isGif(post.url)) {
            return 'gif';
        }
        
        // Default to image
        return 'image';
    }

    getThumbnailUrl(post) {
        if (!post) return '';
        
        // Try preview thumbnail first (usually available)
        if (post.preview?.images?.[0]?.source?.url) {
            return post.preview.images[0].source.url.replace(/&amp;/g, '&');
        }
        
        // Try resolutions (smaller, faster to load)
        if (post.preview?.images?.[0]?.resolutions?.length > 0) {
            const resolutions = post.preview.images[0].resolutions;
            // Use a medium-sized resolution for poster
            const mediumRes = resolutions[Math.floor(resolutions.length / 2)] || resolutions[resolutions.length - 1];
            if (mediumRes?.url) {
                return mediumRes.url.replace(/&amp;/g, '&');
            }
        }
        
        // Try thumbnail from post data
        if (post.thumbnail && post.thumbnail !== 'self' && post.thumbnail !== 'default' && post.thumbnail !== 'nsfw') {
            return post.thumbnail;
        }
        
        return '';
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    async loadMore() {
        this.showLoading(true);
        await this.fetchPosts();
    }

    clearContent() {
        this.posts = [];
        this.filteredPosts = [];
        this.currentAfter = null;
        document.getElementById('content').innerHTML = '';
        document.getElementById('loadMore').classList.add('hidden');
        // Don't clear the input value - keep it for user convenience
    }

    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    showError(message) {
        const error = document.getElementById('error');
        error.textContent = message;
        error.classList.remove('hidden');
    }

    hideError() {
        document.getElementById('error').classList.add('hidden');
    }

    openViewer(index, autoStartSlideshow = true) {
        if (index < 0 || index >= this.filteredPosts.length) return;
        
        this.currentViewerIndex = index;
        const post = this.filteredPosts[index];
        const modal = document.getElementById('viewerModal');
        const viewerImage = document.getElementById('viewerImage');
        const viewerVideo = document.getElementById('viewerVideo');
        
        // Pause and reset current video if playing
        if (!viewerVideo.classList.contains('hidden')) {
            viewerVideo.pause();
            viewerVideo.currentTime = 0;
            // Remove previous event handlers
            if (this.videoLoopHandler) {
                viewerVideo.removeEventListener('timeupdate', this.videoLoopHandler);
                this.videoLoopHandler = null;
            }
            if (this.videoEndedHandler) {
                viewerVideo.removeEventListener('ended', this.videoEndedHandler);
                this.videoEndedHandler = null;
            }
        }
        
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        
        const mediaUrl = this.getMediaUrl(post);
        const mediaType = this.getMediaType(post);
        
        // Reset loop count
        this.videoLoopCount = 0;
        this.currentMediaIsVideo = (mediaType === 'video' || mediaType === 'gif');
        
        // Hide both media elements first
        viewerImage.classList.add('hidden');
        viewerVideo.classList.add('hidden');
        
        if (this.currentMediaIsVideo) {
            // Use video element for both videos and GIFs (since Reddit serves GIFs as MP4)
            viewerVideo.src = mediaUrl;
            viewerVideo.muted = true;
            viewerVideo.loop = this.isAutoPlayMode ? false : true; // Don't loop in auto-play mode
            viewerVideo.playsInline = true;
            viewerVideo.controls = !this.isAutoPlayMode; // Hide controls in auto-play mode
            viewerVideo.classList.remove('hidden');
            
            if (this.isAutoPlayMode) {
                // In auto-play mode: advance when video ends
                this.videoEndedHandler = () => {
                    // Auto-advance when video ends in auto-play mode
                    setTimeout(() => {
                        if (this.isAutoPlayMode && this.isSlideshowPlaying) {
                            this.navigateViewer(1);
                        }
                    }, 500);
                };
                viewerVideo.addEventListener('ended', this.videoEndedHandler);
            } else {
                // Normal mode: track video loops for slideshow
                let lastTime = 0;
                let nearEnd = false;
                this.videoLoopHandler = () => {
                    const currentTime = viewerVideo.currentTime;
                    const duration = viewerVideo.duration;
                    
                    // Check if we're near the end (within 0.3 seconds)
                    if (duration > 0 && currentTime >= duration - 0.3) {
                        nearEnd = true;
                    }
                    
                    // Detect when video loops back to beginning
                    if (nearEnd && currentTime < 0.5 && lastTime > 0.5) {
                        this.videoLoopCount++;
                        nearEnd = false;
                        // Advance slideshow after target number of loops
                        if (this.videoLoopCount >= this.targetLoopCount && this.isSlideshowPlaying) {
                            setTimeout(() => {
                                if (this.isSlideshowPlaying) {
                                    this.navigateViewer(1);
                                }
                            }, 100);
                        }
                    }
                    lastTime = currentTime;
                };
                viewerVideo.addEventListener('timeupdate', this.videoLoopHandler);
            }
            
            viewerVideo.load(); // Reload video
            
            // Play video after it's loaded
            const playVideo = () => {
                viewerVideo.play().catch(err => {
                    // Ignore AbortError and NotAllowedError - these are expected
                    if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                        console.log('Video/GIF play failed:', err);
                    }
                });
            };
            
            if (viewerVideo.readyState >= 2) {
                // Video already loaded
                playVideo();
            } else {
                // Wait for video to load
                viewerVideo.addEventListener('loadeddata', playVideo, { once: true });
            }
        } else {
            viewerImage.src = mediaUrl;
            viewerImage.classList.remove('hidden');
        }
        
        // Update info
        document.getElementById('viewerTitle').textContent = post.title;
        document.getElementById('viewerSubreddit').textContent = `r/${post.subreddit}`;
        document.getElementById('viewerStats').innerHTML = `
            <span>⬆ ${this.formatNumber(post.ups)}</span>
            <span>💬 ${this.formatNumber(post.num_comments)}</span>
        `;
        
        // Update counter
        document.getElementById('viewerCounter').textContent = `${index + 1} / ${this.filteredPosts.length}`;
        
        // Auto-start slideshow only if requested
        if (autoStartSlideshow) {
            this.startSlideshow();
        }
    }

    closeViewer() {
        const modal = document.getElementById('viewerModal');
        const viewerVideo = document.getElementById('viewerVideo');
        
        // Exit fullscreen if in auto-play mode
        if (this.isAutoPlayMode && document.fullscreenElement) {
            document.exitFullscreen();
        }
        
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        
        // Pause video and stop slideshow
        viewerVideo.pause();
        // Remove event handlers
        if (this.videoLoopHandler) {
            viewerVideo.removeEventListener('timeupdate', this.videoLoopHandler);
            this.videoLoopHandler = null;
        }
        if (this.videoEndedHandler) {
            viewerVideo.removeEventListener('ended', this.videoEndedHandler);
            this.videoEndedHandler = null;
        }
        this.stopSlideshow();
        
        // Reset auto-play mode
        if (this.isAutoPlayMode) {
            this.isAutoPlayMode = false;
            const autoPlayBtn = document.getElementById('autoPlayBtn');
            autoPlayBtn.classList.remove('active');
            autoPlayBtn.textContent = '▶ Auto-Play Mode';
        }
        
        this.currentViewerIndex = -1;
        this.videoLoopCount = 0;
        this.currentMediaIsVideo = false;
    }

    navigateViewer(direction) {
        if (this.filteredPosts.length === 0) return;
        
        const wasPlaying = this.isSlideshowPlaying;
        this.stopSlideshow();
        
        let newIndex = this.currentViewerIndex + direction;
        if (newIndex < 0) {
            newIndex = this.filteredPosts.length - 1;
        } else if (newIndex >= this.filteredPosts.length) {
            newIndex = 0;
        }
        
        // Preserve slideshow state when navigating
        this.openViewer(newIndex, wasPlaying);
    }

    startSlideshow() {
        this.stopSlideshow();
        this.isSlideshowPlaying = true;
        const playPauseIcon = document.getElementById('playPauseIcon');
        if (playPauseIcon) {
            playPauseIcon.textContent = '⏸';
        }
        
        // For images, use time-based slideshow
        // For videos/GIFs, advancement is handled by loop count tracking or ended event
        this.slideshowInterval = setInterval(() => {
            // Only advance if current media is NOT a video/GIF (images use time-based)
            // In auto-play mode, videos advance via ended event, so skip interval for videos
            if (!this.currentMediaIsVideo || !this.isAutoPlayMode) {
                this.navigateViewer(1);
            }
        }, this.slideshowSpeed);
    }

    stopSlideshow() {
        if (this.slideshowInterval) {
            clearInterval(this.slideshowInterval);
            this.slideshowInterval = null;
        }
        this.isSlideshowPlaying = false;
        document.getElementById('playPauseIcon').textContent = '▶';
    }

    toggleSlideshow() {
        if (this.isSlideshowPlaying) {
            this.stopSlideshow();
        } else {
            this.startSlideshow();
        }
    }

    toggleFullscreen() {
        const modal = document.getElementById('viewerModal');
        
        if (!document.fullscreenElement) {
            modal.requestFullscreen().catch(err => {
                console.log('Fullscreen error:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

}

// Initialize the viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new RedditViewer();
});

