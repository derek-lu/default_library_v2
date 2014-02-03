/**
 * Displays the preview dialog that displays the folio cover, title, download button and preview button.
 */
var ADOBE = ADOBE || {};

ADOBE.PreviewDialog = Backbone.View.extend({
	tagName:  "div",
	
	className: "modal-background-grey",
	
	events: {
		"click #preview-dialog-close-button": "close"
	},
	
	// The container that holds the header and image.
	$contentContainer: null,
	
	// The id of the originating folio thumb. 
	folioThumbElementId: null,
	
	PORTRAIT_WIDTH: 488,
	PORTRAIT_HEADER_HEIGHT: 128,
	PORTRAIT_IMAGE_HEIGHT: 650,
	
	LANDSCAPE_WIDTH: 570,
	LANDSCAPE_HEADER_HEIGHT: 128,
	LANDSCAPE_IMAGE_HEIGHT: 427,
	
	initialize: function() {
		var html  = "<div id='preview-dialog-content-container'>";
			html +=		"<div id='preview-dialog-header-container'>";
			html +=			"<div id='preview-dialog-header'>";
			html +=				"<div id='preview-dialog-header-text-container'>";
			html +=					"<div class='magazine-title'></div>";
			html +=					"<div class='folio-number'></div>";
			html +=					"<div class='description'></div>";
			html += 			"</div>";
			html +=				"<div id='preview-dialog-header-button-container'>";
			html +=     			"<div class='grey-button button' id='download-button'>Download</div>";
			html += 			"</div>";
			html += 		"</div>";
			html +=		"</div>";
			html += 	"<div id='preview-dialod-folio-cover-container'><img id='preview-dialog-folio-cover'></div>";
			html +=	"</div>";
			html += "<div id='preview-dialog-close-button'>X</div>";
		
		// Don't allow the user to scroll the background grid while this dialog is open.
		document.ontouchmove = function(e){
		    e.preventDefault();
		}
		
		var scope = this;
		$(window).on("resize", function() {
			scope.updateView();
		})
			
		this.template = _.template(html);
		
		// Triggered from the dialog when a purchase is successful.
		$("body").on("subscriptionPurchased", function() {
			scope.close();
		});
	},
	
	render: function() {
		this.$el.html(this.template());
		
		this.$contentContainer = this.$el.find("#preview-dialog-content-container");
		
		this.$el.find(".magazine-title").html(this.model.title);
		this.$el.find(".folio-number").html(this.model.folioNumber);
		
		var scope = this;
		if (ADOBE.isAPIAvailable) {
			this.$el.find("#download-button").on("click", function() {
				if (scope.model.state == ADOBE.FolioStates.PURCHASABLE) {
					var transaction = scope.model.purchase();
					transaction.completedSignal.addOnce(function(transaction) {
						if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED) {
							scope.model.download();
							scope.close();
						}
					}, this);
						
				} else {
					scope.model.download();
					scope.close();
				}
			});
			
			if (this.model.state == ADOBE.FolioStates.PURCHASABLE)
				this.$el.find("#download-button").html(this.model.price);
			
			if (this.model.isPurchasable && !this.model.hasSections) { // Only check to see if preview is supported if this folio is purchasable and doesn't have sections.
				var transaction = this.model.verifyContentPreviewSupported(); // Check to see if this folio supports previews.
				transaction.completedSignal.addOnce(this.verifyContentPreviewSupportedHandler, this);
			}
			this.$el.find(".description").html(this.model.folioDescription);
		} else {
			this.$el.find(".description").html(this.model.description);
		}
		
		this.$el.on("click", function(e) {
			//preview-dialog-content-container
			var clientX = e.clientX;
			var clientY = e.clientY;
			var offset = scope.$contentContainer.offset();
			if (clientX < offset.left || clientX > offset.left + scope.$contentContainer.width() || clientY < offset.top || clientY > offset.top + scope.$contentContainer.height())
				scope.close();
		});
		
		return this;
	},
	
	verifyContentPreviewSupportedHandler: function(transaction) {
		if (transaction.state == adobeDPS.transactionManager.transactionStates.FINISHED) {
			if (this.model.canDownloadContentPreview() || // Preview has not been downloaded yet.
				this.model.supportsContentPreview) { 	  // canDownloadContentPreview()==false but supportsContentPreview==true so preview has already been downloaded.
				this.showPreviewButton();

				// Add a click handler for the text link.
				var scope = this;
				this.$el.find("#preview-button").on("click", function() {
					try {
						if (scope.model.canDownloadContentPreview()) {	// Preview can be downloaded.
							// Start the download.
							scope.model.downloadContentPreview();
							scope.close();
						} else { 										// Preview is already downloaded so view the folio.
							// Check to see if the downloaded content preview is now entitled.
							// First check if it is downloadable (only true if entitled)
							// and the folio is not updatable
							// and we do not have a download going.
							// If so, start a download because we expect one to
							// be acting on the folio if we are not done
							if (scope.model.isDownloadable &&
								!scope.model.isUpdatable &&
								scope.model.currentStateChangingTransaction() == null) {
								// Start a new download transaction to get the rest of the folio
								scope.model.download();
							}
							
							scope.model.view();
						}
					} catch(e) {
						alert(e);
					}
				});
			}
		}
	},
	
	showSubscribeButton: function() {
		var $subscribeButton = $("<div class='grey-button button'>Subscribe</div>");
		$subscribeButton.appendTo(this.$el.find("#preview-dialog-header-button-container"));
		
		var scope = this;
		$subscribeButton.on("click", function() {
			scope.$el.trigger("subscribeButtonClicked");
		});
	},
	
	showPreviewButton: function() {
		$("<div class='grey-button button' id='preview-button'>Preview</div>").appendTo(this.$el.find("#preview-dialog-header-button-container"));
	},
	
	setImageProperties: function($target, folioThumbElementId) {
		this.folioThumbElementId = folioThumbElementId;
		
		this.$el.find("#preview-dialog-folio-cover").attr("src", $target.attr("src"));
		// Position the image at the originating folio thumb cover.
		var offset = $target.offset();
		
		var scale;
		if (window.innerWidth > window.innerHeight) { // landscape
			scale = $target.parent().width() / this.LANDSCAPE_WIDTH; // In landscape the image is centered in a container
			this.$contentContainer.css("-webkit-transform", "translate(" + (offset.left - 66) + "px, " + (offset.top - $(window).scrollTop() - this.LANDSCAPE_HEADER_HEIGHT * scale - 3) + "px) scale(" + scale + ", " + scale + ")");
		} else { // portrait
			scale = $target.width() / this.PORTRAIT_WIDTH;
			this.$contentContainer.css("-webkit-transform", "translate(" + (offset.left - 2) + "px, " + (offset.top - $(window).scrollTop() - this.PORTRAIT_HEADER_HEIGHT * scale - 3) + "px) scale(" + scale + ", " + scale + ")");
		}

		this.$contentContainer.css("-webkit-transform-origin", "0 0");
		
		// Flip the header so it is visible.
		this.$el.find("#preview-dialog-header").css("-webkit-transform", "rotateX(0deg)");
		
		var scope = this;
		this.$contentContainer.on("webkitTransitionEnd", function() {
			scope.folioCoverOpen_transitionEndHandler();
		});
		
		// Wait one frame to animate otherwise the image will not animate from the correct spot.
		setTimeout(function() {
			scope.$contentContainer.css("-webkit-transition", "all .4s");
			scope.updateView();
		}, 1)
	},
	
	updateView: function() {
		var targetX, targetY;
		if (window.innerWidth > window.innerHeight) { // landscape
			targetX = Math.round((window.innerWidth - this.LANDSCAPE_WIDTH) / 2);
			targetY = Math.round((window.innerHeight - (this.LANDSCAPE_HEADER_HEIGHT + this.LANDSCAPE_IMAGE_HEIGHT)) / 2);
		} else { // portrait
			targetX = Math.round((window.innerWidth - this.PORTRAIT_WIDTH) / 2);
			targetY = Math.round((window.innerHeight - (this.PORTRAIT_HEADER_HEIGHT + this.PORTRAIT_IMAGE_HEIGHT)) / 2);
		}
		
		// Need to use translate and scale rather than x,y,width,height otherwise the animation is choppy.
		this.$contentContainer.css("-webkit-transform", "translate(" + targetX + "px, " + targetY + "px) scale(1, 1)");
		
		this.$el.find("#preview-dialog-close-button").css("left", targetX - 17);
		this.$el.find("#preview-dialog-close-button").css("top", targetY - 17);
	},
	
	// Handler for when the image finishes expanding.
	folioCoverOpen_transitionEndHandler: function() {
		this.$contentContainer.off("webkitTransitionEnd");
		// Remove the transitions so the user does not see any animations if the device is rotated.
		this.$contentContainer.css("-webkit-transition", "none");
		this.$el.find("#preview-dialog-header").css("-webkit-transition", "none");

		this.$el.find("#preview-dialog-close-button").show();
	},

	close: function() {
		this.$el.find("#preview-dialog-header").css("-webkit-transition", ".4s");
		this.$el.find("#preview-dialog-header").css("-webkit-transform", "rotateX(180deg)");
		this.$el.find("#preview-dialog-close-button").hide();
		
		// Get a reference to the element that triggered the opening of this dialog.
		// Since the user might have rotated the device while this dialog is open this
		// ensures the dialog can close to the original element.
		var $target = $("#" + this.folioThumbElementId);
		
		var offset = $target.offset();
		this.$contentContainer.css("-webkit-transition", "all .4s");
		
		var scale;
		if (window.innerWidth > window.innerHeight) { // landscape
			scale = $target.parent().width() / this.LANDSCAPE_WIDTH;
			this.$contentContainer.css("-webkit-transform", "translate(" + (offset.left - 66) + "px, " + (offset.top - $(window).scrollTop() - this.LANDSCAPE_HEADER_HEIGHT * scale - 3) + "px) scale(" + scale + ", " + scale + ")");
			this.$el.find("#preview-dialod-folio-cover-container").css("border", "none");
		} else {
			scale = $target.width() / this.PORTRAIT_WIDTH;
			this.$contentContainer.css("-webkit-transform", "translate(" + (offset.left - 2) + "px, " + (offset.top - $(window).scrollTop() - this.PORTRAIT_HEADER_HEIGHT * scale - 3) + "px) scale(" + scale + ", " + scale + ")");
		}
		
		var scope = this;
		this.$contentContainer.on("webkitTransitionEnd", function() {
			scope.$el.remove();
			scope.remove();
		});
		
		document.ontouchmove = null;
	}
});
