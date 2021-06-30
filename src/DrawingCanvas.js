
/**
 * Extention class that provides drawing abilities
 */
class DrawingCanvas extends Canvas{
	
	/**
	 * Construct a new instance of the Canvas class
	 * @param {HTMLElement} canvas - The canvas to instantiate the class upon.
	 * @param {Number} [opts.anchorRadius=Canvas.anchorRadius] - The radius of the anchor points shown on selected elements.
	 * @param {String} [opts.strokeStyle=Canvas.strokeStyle] - The color of the outlines drawn on selceted elements. May be any valid CSS color string.
	 * @param {String} [opts.fillStyle=Canvas.fillStyle] - The color of the anchor points shown on selected elements. May be any valid CSS color string.
	 * @param {Number} [opts.lineWidth=Canvas.lineWidth] - The width of the outlines shown on selected elements.
	 * @param {String} [opts.cursors.default=Canvas.cursors.default] - The default cursor to use when hovering over the canvas. May be any valid css cursor value.
	 * @param {String} [opts.cursors.grab=Canvas.cursors.grab] - The grab cursor to use when hovering over a movable layer. May be any valid css cursor value.
	 * @param {String} [opts.cursors.grabbing=Canvas.cursors.grabbing] - The grabbing cursor to use when dragging a layer. May be any valid css cursor value.
	 * @param {String} [opts.cursors.move=Canvas.cursors.move] - The default cursor to use when hovering over a resize anchor. May be any valid css cursor value.
	 * @param {String} [opts.cursors.rotate=Canvas.cursors.rotate] - The default cursor to use when hovering a rotate anchor point. May be any valid css cursor value.
	 * @param {String} [opts.cursors.rotating=Canvas.cursors.rotating] - The default cursor to use when rotating an active layer. May be any valid css cursor value.
	 * @returns {Canvas}
	 */
	constructor(canvas, opts={}){
		super(canvas, opts);
		
		// The current action....
		// one of... "rectangle", "ellipse", "line", "freehand"
		this.drawing_mode = null;
		
		// Styling options
		this.line_color = '#000000';
		this.fill_color = '#0000FF';
		
		// The x, y coords of the starting position of the current shape
		this.shape_start_pos = null;
		
		// Is the mouse button pressed?
		this.is_mouse_down = false;
		
		// An array of points that represents the current 
		// shape if the drawing mode is "freehand"
		this.freehand_coords = [];
		
		// An invisible canvas on which the user's input is rendered
		// This canvas is the same height and width as the original canvas
		this.rcanvas = document.createElement('canvas');
		this.rcanvas.height = this.height;
		this.rcanvas.width = this.width;
		this.rctx = this.rcanvas.getContext('2d');
		
		// As images are rendered on the rcanvas, they are copied to this canvas
		// and this canvas is resized and used to update the current active layer
		this.ccanvas = document.createElement('canvas');
		this.cctx = this.ccanvas.getContext('2d');
		
		// The layer that is being drawn via the above ccanvas
		this.drawing_layer = null;
		
		// dimensions of the current active layer as it's being created
		this.layer_dimensions = null;
		
	}
	
	/**
	 * Set the border or line width;
	 * @param {Number} width
	 * @returns {undefined}
	 */
	setLineWidth(width){
		this.rctx.lineWidth = +width;
	}
	
	/**
	 * Set the CSS color style of the border or line
	 * @param {string} style
	 * @returns {undefined}
	 */
	setStrokeStyle(style){
		this.rctx.strokeStyle = style;
	}
	
	/**
	 * Set the CSS color style background of the shape
	 * @param {string} style
	 * @returns {undefined}
	 */
	setFillStyle(style){
		this.rctx.fillStyle = style;
	}
	
	////////////////////////////////////////////////////////////////////////////
	// Helpers /////////////////////////////////////////////////////////////////
	////////////////////////////////////////////////////////////////////////////
	
	/**
	 * @ignore
	 * Helper function to draw a circle on a canvas
	 */
	drawEllipse(ctx, x, y, w, h) {
		var kappa = .5522848,
			ox = (w / 2) * kappa, // control point offset horizontal
			oy = (h / 2) * kappa, // control point offset vertical
			xe = x + w, // x-end
			ye = y + h, // y-end
			xm = x + w / 2, // x-middle
			ym = y + h / 2; // y-middle

		ctx.save();
		ctx.beginPath();
		ctx.moveTo(x, ym);
		ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
		ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
		ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
		ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}
	
	/**
	 * @ignore
	 * Copy the rcanvas image to the ccanvas and resize the ccanvas, then 
	 * create or update the current active layer
	 */
	renderLayer(){
		// Copy the rcavnas image to the canvas, crop it and render it to a dataURL
		var {x, y, width, height} = this.layer_dimensions;
		
		width += this.rctx.lineWidth * 2;
		height += this.rctx.lineWidth * 2;
		x -= this.rctx.lineWidth;
		y -= this.rctx.lineWidth;
		
		this.ccanvas.width = width;
		this.ccanvas.height = height;
		this.cctx.clearRect(0, 0, width, height);
		this.cctx.drawImage(this.rcanvas, x, y, width, height, 0, 0, width, height);
		var duri = this.ccanvas.toDataURL();
		
		// Get new layer center position
		const xpos = x + (width/2);
		const ypos = y + (height/2);
		
		if(!this.drawing_layer){
			// If there is not currently an active drawing layer, create it
			this.drawing_layer = this.addLayer(duri, {xpos, ypos});
		}else{
			// If there is an active layer, update the image and the 
			// dimensions and reload
			this.drawing_layer.x = xpos;
			this.drawing_layer.y = ypos;
			this.drawing_layer.width = width;
			this.drawing_layer.height = height;
			this.drawing_layer.url = duri;
			this.drawing_layer.ready = false;
			this.drawing_layer.image = null;
			this.drawing_layer.load().then(()=>this.draw());
		}
	}
	
	/**
	 * @ignore
	 * Update layer dimesions property (this.layer_dimensions) 
	 * of the active layer based on the user input 
	 */
	recalculateLayerDimensions(newMousePos){
		var x, y, width, height;
		if(this.drawing_mode === 'freehand'){
			
			// If user is drawing freehand, add the next coordinates
			// to the freehand_coords array
			this.freehand_coords.push(newMousePos);
			var all_x = this.freehand_coords.map(c=>c.x);
			var all_y = this.freehand_coords.map(c=>c.y);
			
			// Get minimum and maximum x and y points in the freehand drawing
			x = Math.min(...all_x);
			y = Math.min(...all_y);
			var max_x = Math.max(...all_x);
			var max_y = Math.max(...all_y);
			width = Math.max(0.1, Math.abs(x - max_x));
			height = Math.max(0.1, Math.abs(y - max_y));
		}else{
			x = Math.min(this.shape_start_pos.x, newMousePos.x);
			y = Math.min(this.shape_start_pos.y, newMousePos.y);
			width = Math.max(0.1, Math.abs(this.shape_start_pos.x - newMousePos.x));
			height = Math.max(0.1, Math.abs(this.shape_start_pos.y - newMousePos.y));
		}
		this.layer_dimensions = {x, y, width, height};
	}
	
	/**
	 * @ignore
	 * How to handle mouse input
	 */
	onmousemove(e){
		
		// If there isn't a drawing mode set let the parent class handle it
		if(!this.drawing_mode) return super.onmousemove(e);
		if(!this.is_mouse_down) return;
		
		// Clear the rendering canvas		
		this.rctx.clearRect(0, 0, this.width, this.height);
		
		// Get the current mouse position relative to the canvas
		const pos = this.canvasMousePos(e);
		
		// Update the layer_dimensions property
		this.recalculateLayerDimensions(pos);
		
		// Handle the mouse movement based on the active drawing mode...
		switch(this.drawing_mode){
			
			case "rectangle":
				var {x, y, width, height} = this.layer_dimensions;
				this.rctx.beginPath();
				this.rctx.rect(x, y, width, height);
				this.rctx.fill();
				this.rctx.stroke();
				this.renderLayer();
				break;
				
			case "ellipse":
				var {x, y, width, height} = this.layer_dimensions;
				this.drawEllipse(this.rctx, x, y, width, height);
				this.renderLayer();
				break;
				
			case "line":
				var x1 = this.shape_start_pos.x, 
					y1 = this.shape_start_pos.y, 
					x2 = pos.x, 
					y2 = pos.y;
				this.rctx.beginPath();
				this.rctx.moveTo(x1, y1);
				this.rctx.lineTo(x2, y2);
				this.rctx.fill();
				this.rctx.stroke(); 
				this.renderLayer();
				break;
				
			case "freehand":
				if(this.freehand_coords < 2) break;
				var a = this.freehand_coords[0];
				for(var i=1; i<this.freehand_coords.length; i++){
					this.rctx.beginPath();
					this.rctx.moveTo(a.x, a.y);
					this.rctx.lineTo(this.freehand_coords[i].x, this.freehand_coords[i].y);
					this.rctx.fill();
					this.rctx.stroke(); 
					a = this.freehand_coords[i];
				}
				this.renderLayer();
				break;
				
		}
	}
	
	/**
	 * @ignore
	 * On mousedown we set flags to render a new layer on mouse move
	 */
	onmousedown(e){
		if(!this.drawing_mode) return super.onmousedown(e);
		this.is_mouse_down = true;
		this.shape_start_pos = this.canvasMousePos(e);
	}
	
	/**
	 * @ignore
	 * on mouse up and when mouse runs out of the canvas reset everything
	 */
	onmousereset(e){
		if(!this.drawing_mode) return super.onmousereset(e);
		this.is_mouse_down = false;
		this.shape_start_pos = null;
		this.drawing_layer = null;
		this.layer_dimensions = null;
		this.freehand_coords = [];
	}
	
}