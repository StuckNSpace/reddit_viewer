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
        
        this.initializeEventListeners();
        this.initializeViewer();
    }

    initializeEventListeners() {
        document.getElementById('loadBtn').addEventListener('click', () => this.loadContent());
        document.getElementById('clearBtn').addEventListener('click', () => this.clearContent());
        document.getElementById('loadMoreBtn').addEventListener('click', () => this.loadMore());
        document.getElementById('imagesOnly').addEventListener('change', (e) => {
            this.imagesOnly = e.target.checked;
            this.filterAndDisplay();
        });
        document.getElementById('videosOnly').addEventListener('change', (e) => {
            this.videosOnly = e.target.checked;
            this.filterAndDisplay();
        });

        // Load on Enter key
        document.getElementById('subreddits').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadContent();
            }
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
            
            // Fetch from all subreddits in parallel
            const promises = this.currentSubreddits.map(subreddit => 
                this.fetchSubredditPosts(subreddit)
            );
            
            const results = await Promise.allSettled(promises);
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    allPosts.push(...result.value);
                } else {
                    console.error(`Failed to fetch ${this.currentSubreddits[index]}:`, result.reason);
                }
            });

            // Sort by score (upvotes) descending
            allPosts.sort((a, b) => b.score - a.score);
            
            this.posts = [...this.posts, ...allPosts];
            this.filterAndDisplay();
            
        } catch (error) {
            console.error('Error fetching posts:', error);
            this.showError('Failed to load content. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async fetchSubredditPosts(subreddit) {
        const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25${this.currentAfter ? `&after=${this.currentAfter}` : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (this.currentAfter === null) {
            // Only update after token on first load
            this.currentAfter = data.data.after;
        }
        
        return data.data.children.map(child => child.data);
    }

    filterAndDisplay() {
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
        if (this.isShuffled) {
            this.shuffleArray(filtered);
        }

        this.filteredPosts = filtered;
        this.displayPosts(filtered);
    }

    shuffleArray(array) {
        // Fisher-Yates shuffle algorithm
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
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
        this.openViewer(startIndex, true);
        
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

    displayPosts(posts) {
        const contentGrid = document.getElementById('content');
        
        if (posts.length === 0) {
            contentGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">No media content found. Try different subreddits or adjust filters.</p>';
            document.getElementById('loadMore').classList.add('hidden');
            return;
        }

        // Clear existing content
        contentGrid.innerHTML = '';

        posts.forEach(post => {
            const card = this.createMediaCard(post);
            contentGrid.appendChild(card);
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
            video.preload = 'metadata';
            
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
            
            // Auto-play on hover, pause on leave
            card.addEventListener('mouseenter', () => {
                video.play().catch(err => console.log('Video/GIF play failed:', err));
                video.controls = true;
            });
            
            card.addEventListener('mouseleave', () => {
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
        this.currentAfter = null;
        document.getElementById('content').innerHTML = '';
        document.getElementById('loadMore').classList.add('hidden');
        document.getElementById('subreddits').value = '';
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
            viewerVideo.loop = true;
            viewerVideo.playsInline = true;
            viewerVideo.controls = true;
            viewerVideo.classList.remove('hidden');
            
            // Track video loops for slideshow
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
                // This happens when currentTime resets to near 0 after being near the end
                if (nearEnd && currentTime < 0.5 && lastTime > 0.5) {
                    this.videoLoopCount++;
                    nearEnd = false;
                    // Advance slideshow after target number of loops
                    if (this.videoLoopCount >= this.targetLoopCount && this.isSlideshowPlaying) {
                        // Small delay to ensure smooth transition
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
            
            // Also listen for 'ended' event as fallback (though loop=true should prevent this)
            this.videoEndedHandler = () => {
                if (viewerVideo.loop) {
                    this.videoLoopCount++;
                    if (this.videoLoopCount >= this.targetLoopCount && this.isSlideshowPlaying) {
                        setTimeout(() => {
                            if (this.isSlideshowPlaying) {
                                this.navigateViewer(1);
                            }
                        }, 100);
                    }
                }
            };
            viewerVideo.addEventListener('ended', this.videoEndedHandler);
            
            viewerVideo.load(); // Reload video
            viewerVideo.play().catch(err => console.log('Video/GIF play failed:', err));
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
        document.getElementById('playPauseIcon').textContent = '⏸';
        
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

    // Search feature removed for Android TV optimization
    /*     // Search feature removed for Android TV optimization
}

// Initialize the viewer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new RedditViewer();
});

