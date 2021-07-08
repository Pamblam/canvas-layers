
class TypingCanvas extends DrawingCanvas{
	
	constructor(canvas, opts={}){
		super(canvas, opts);
		
		// Font style options
		this.font_face = opts.font_face || null;
		this.font_color = opts.font_color || null;
		this.font_size = opts.font_size || 12;
		
		// Flag to indicate if the user has finished defining the boundary box
		this.boundry_defined = false;
		
		// The keylogger utlity that captures keyboard input
		this.keylogger = null;
		
		// Flag that updates every fraction of a second to indicate 
		// if the flashing cursor is currently visible, 
		// when the textarea is active
		this.flashing_cursor_visible = false;
		
		// The timer that changes the state of this.flashing_cursor_visible
		this.flashing_cursor_timer = null;
		
		// We need a mouseup event listener to know when the boundary is drawn...
		this.canvas.addEventListener('mouseup', this.onmouseup.bind(this));
		
		document.body.appendChild(this.ccanvas);
		document.body.appendChild(this.rcanvas);
	}
	
	/**
	 * @ignore
	 */
	onmousemove(e){
		if(this.drawing_mode !== 'text') return super.onmousemove(e);
		if(!this.is_mouse_down) return;
		
		this.rctx.clearRect(0, 0, this.width, this.height);
		const pos = this.canvasMousePos(e);
		this.recalculateLayerDimensions(pos);
		this.drawBoundary();
	}
	
	/**
	 * Draws the text boundary rectangle
	 * @returns {undefined}
	 */
	drawBoundary(){
		var {x, y, width, height} = this.layer_dimensions;
		
		this.rctx.save();
		this.rctx.lineWidth = 3;
		this.rctx.strokeStyle = '#000 dashed';
		this.rctx.fillStyle = null;
		this.rctx.setLineDash([5, 15]);
		this.rctx.beginPath();
		this.rctx.rect(x, y, width, height);
		this.rctx.fill();
		this.rctx.stroke();
		this.rctx.restore();
		this.renderLayer();
	}
	
	/**
	 * Given a context and some text it returns the width and height of the text
	 * @param {type} ctx
	 * @param {type} text
	 * @returns {TypingCanvas.getTextSize.TypingCanvasAnonym$2}
	 */
	getTextSize(ctx, text){
		let metrics = ctx.measureText(text);
		return {
			width: metrics.width,
			height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
		}
	}

	/**
	 * Draw text using the actual top left corner as a reference point
	 * @param {type} ctx
	 * @param {type} text
	 * @param {type} x
	 * @param {type} y
	 * @returns {undefined}
	 */
	fillTextCorrected(ctx, text, x, y){
		let metrics = ctx.measureText(text);
		x += metrics.actualBoundingBoxLeft;
		y += metrics.actualBoundingBoxAscent;
		ctx.fillText(message, x, y);
	}
	
	/**
	 * @ignore
	 * On mousedown we set flags to render a new layer on mouse move
	 */
	onmousedown(e){
		if(this.drawing_mode !== 'text') return super.onmousedown(e);

		// If there is NOT an active drawing layer, start one
		if(!this.drawing_layer){
			
			var {x, y} = this.canvasMousePos(e);
			var layer = this.getLayerAt(x, y);
			if(layer && layer.properties.is_text_layer){
				// selecting the clicked on text layer
				this.editTextLayer(layer);
			}else{
				// starting a new boundary box
				this.is_mouse_down = true;
				this.shape_start_pos = this.canvasMousePos(e);
			}
			
		}else{
			
			var {x, y} = this.canvasMousePos(e);
			this.setCursor(x, y);
			if(this.isNearActiveRotatePoint(x, y)){
				if(this.fireEvent('layer-rotate-start')){
					this.activeLayerRotateStartPos = {x, y};
					this.rotatingActiveLayer = true;
				}
			}else if(this.isNearActiveCorner(x, y)){
				if(this.fireEvent('layer-resize-start')){
					this.resizingActiveLayer = true;
				}
			}else{
				
				var layer = this.getLayerAt(x, y);
				if(layer !== this.drawing_layer){
					// User clicked outside the text layer, reset the drawing mode
					this.resetTextEditor();
				}
				
			}
			
		}
	}
	
	/**
	 * Edit the provided text layer
	 * @ignore
	 */
	editTextLayer(layer){
		this.drawing_layer = layer;
		this.boundry_defined = true;
		
		var x_diff = layer.properties.last_position.x - layer.x;
		var y_diff = layer.properties.last_position.y - layer.y;
		
		this.layer_dimensions = layer.properties.layer_dimensions;
		this.layer_dimensions.x -= x_diff;
		this.layer_dimensions.y -= y_diff;
		
		this.shape_start_pos = layer.properties.shape_start_pos;
		this.shape_start_pos.x -= x_diff;
		this.shape_start_pos.y -= y_diff;
		
		this.font_face = layer.properties.font_face;
		this.font_size = layer.properties.font_size;
		this.font_color = layer.properties.font_color;
		
		this.activateTypeArea();
		this.keylogger.input = layer.properties.keylogger_input;
		this.keylogger.cursor_pos = this.keylogger.input.length;
		this.renderTypeArea();
	}
	
	/**
	 * Deselect any active layers and disable any editable textareas on the canvas.
	 * @returns {undefined}
	 */
	deSelectLayer(){
		super.deSelectLayer();
		this.resetTextEditor();
	}
	
	renderLayer(){
		super.renderLayer();
		this.drawing_layer.properties.is_text_layer = true;
		this.drawing_layer.properties.font_face = this.font_face;
		this.drawing_layer.properties.font_size = this.font_size;
		this.drawing_layer.properties.font_color = this.font_color;
		this.drawing_layer.properties.shape_start_pos = this.shape_start_pos;
		this.drawing_layer.properties.layer_dimensions = this.layer_dimensions;
		this.drawing_layer.properties.keylogger_input = this.keylogger ? this.keylogger.input : [];
		this.drawing_layer.properties.last_position = {
			x: this.drawing_layer.x,
			y: this.drawing_layer.y
		};
	}
	
	/**
	 * Draw the active type area
	 * @returns {undefined}
	 */
	renderTypeArea(active=true){
		var is_text_layer_active = this.drawing_layer && this.drawing_layer.properties.is_text_layer;
		
		this.rctx.clearRect(0, 0, this.width, this.height);
		if(active && is_text_layer_active){
			this.drawBoundary();
		}
		
		if(is_text_layer_active){
			
			this.rctx.save();

			var textStyle = new CanvasTextStyle({base_line: 'top'});
			if(this.font_size) textStyle.setFontSize(this.font_size+"px");
			if(this.font_face) textStyle.setFontFamily(this.font_face);
			if(this.font_color) textStyle.setFillStyle(this.font_color);
			textStyle.setFillStyle(this.font_color);
			textStyle.setContext(this.rctx);

			var {x, y, width, height} = this.layer_dimensions;
			var text_spacing = 0; // add this to the class later...
			var line_spacing = 0; // add to class later
			var text_lines = this.generateCanvasTextLines(this.rctx, this.keylogger.val(), width, text_spacing, line_spacing);
			
			var char_before_cursor = null;
			var char_idx = 0;
			for(let i=0; i<text_lines.length; i++){
				let chars = text_lines[i].getChars(this.rctx);
				for(let n=0; n<chars.length; n++){
					char_idx++;
					if(this.keylogger.cursor_pos === char_idx) char_before_cursor = chars[n];
					this.rctx.fillText(chars[n].char, x+chars[n].x, y+chars[n].y);
					
				}
			}
			
			if(char_before_cursor && char_before_cursor.char === "\n"){
				console.log("Found line break...",text_lines);
			}
			
			if(this.flashing_cursor_visible){
				let cursor_x = char_before_cursor ? x+char_before_cursor.x+char_before_cursor.width : x;
				let cursor_start_y = char_before_cursor ? y+char_before_cursor.y : y;
				let cursor_end_y = char_before_cursor ? y+char_before_cursor.y+this.font_size : y+this.font_size;
				
				this.rctx.strokeStyle = '#000000';
				this.rctx.lineWidth = 2;
				
				this.rctx.beginPath();
				this.rctx.moveTo(cursor_x, cursor_start_y);
				this.rctx.lineTo(cursor_x, cursor_end_y);
				this.rctx.stroke();
			}
			
			this.rctx.restore();
			this.renderLayer();
		}
		
		
	}
	
	generateCanvasTextLines(ctx, text, boundary_width, text_spacing, line_spacing){
		
		var textBody = new CanvasTextBody(ctx, {line_spacing, text_spacing, boundary_width});
		
		var characters = text.split('');

		for(let i=0; i<characters.length; i++){

			// The current char
			let character = characters[i];
			textBody.addCharacter(character);
			
			
		}
		
	}
	
	
	_generateCanvasTextLines(ctx, text, boundary_width, text_spacing, line_spacing){
		
		// Array of objects that represent lines of text
		var text_lines = [];

		// Current x/y coords
		var current_x = 0;
		var current_y = 0;

		// The line we are currently building
		var current_line = new CanvasTextLine(ctx, {y: current_y});

		// The most recent state of the line 
		// when it did not exceed the available width
		// or null when there wasn't one
		var last_safe_line = null;

		// Array of characters in the text
		var characters = text.split('');

		for(let i=0; i<characters.length; i++){

			// The current char
			let character = characters[i];

			let char_obj = new CanvasTextChar(ctx, {
				char: character,
				text_spacing
			});

							

			// If the current char is a line break, force new line
			if(character === "\n"){

				// Reset the x and y positions for the new line
				current_x = 0;
				current_y += current_line.getHeight(ctx) + line_spacing;

				// Reset the last safe line
				last_safe_line = null;

				// Set the current line to a new position
				current_line = new CanvasTextLine(ctx, {y: current_y});
				// Push the current line onto the lines array
				text_lines.push(current_line);
			}
			
			current_line.chars.push(char_obj);


			char_obj.x = current_x;
			current_line.width += char_obj.width;

			// If we're on the first character of the line, increase the 
			// current x position by the width of the character, else shift 
			// the current character to the left to line up with the 
			// text alignment line
			if(current_x > 0){
				char_obj.x = current_x - char_obj.bounding_left;
				current_line.width -= char_obj.bounding_left;
				current_x += char_obj.width-char_obj.bounding_left;
			}else{
				current_x += char_obj.width;
			} 
			
			// If it's whitespace, mark it as a potential break point
			if(character.match(/\s/) && character !== "\n"){
				
				last_safe_line = current_line.clone();
				last_safe_line.index_break_pos = i;
			
			}

			// If the current line exceeds available width, 
			// push the last safe line onto the list and reset the
			// current line
			if(boundary_width && current_line.width > boundary_width && last_safe_line){

				// Push the last safe line onto the lines array
				text_lines.push(last_safe_line);

				// Reset the loop position
				i = last_safe_line.index_break_pos;

				// Reset the x and y positions for the new line
				current_x = 0;
				current_y += last_safe_line.getHeight(ctx) + line_spacing;

				// Reset the last safe line
				last_safe_line = null;

				// Set the current line to a new position
				current_line = new CanvasTextLine(ctx, {y: current_y});
			}

			// If we're on the last iteration and still have partial lines,
			// push the partial line onto the lines array
			if(i == characters.length-1 && current_line.chars.length){
				current_x = 0;
				current_y += (last_safe_line || current_line).getHeight(ctx) + line_spacing;
				
				text_lines.push(current_line);
			}

		}

		console.log(text_lines);
		return text_lines;
	}
	
	/**
	 * Begin rendeing the typing area...
	 * @returns {undefined}
	 */
	activateTypeArea(){
		if(this.flashing_cursor_timer !== null) return;
		this.keylogger = new CanvasKeyLogger({
			on_input: (e) => {
				if(this.drawing_layer){
					e.preventDefault();
					this.drawing_layer.properties.text = this.keylogger.val();
					this.flashing_cursor_visible = true;
					this.renderTypeArea();
					
					console.log(this.keylogger.val(true, '|').join(''));
				}
			}
		});
		this.flashing_cursor_timer = setInterval(()=>{
			this.flashing_cursor_visible = !this.flashing_cursor_visible;
			this.renderTypeArea();
		}, 333);
	}
	
	/**
	 * User clicked outside the active text layer, 
	 * reset all the flags and drawing_mode
	 * @returns {undefined}
	 */
	resetTextEditor(){
		this.renderTypeArea(false);
		this.drawing_layer = null;
		this.layer_dimensions = null;
		this.boundry_defined = false;
		this.flashing_cursor_visible = false;
		if(this.flashing_cursor_timer){
			clearInterval(this.flashing_cursor_timer);
			this.flashing_cursor_timer = null;
		}
		if(this.keylogger){
			this.keylogger.disable();
			this.keylogger = null;
		}
		this.shape_start_pos = null;
	}
	
	onmouseup(){
		if(this.drawing_mode !== 'text' || this.boundry_defined) return;
		if(this.shape_start_pos !== null){
			this.boundry_defined = true;
			this.activateTypeArea();
		}
	}
	
	/**
	 * @ignore
	 * on mouse up and when mouse runs out of the canvas reset everything
	 */
	onmousereset(e){
		if(this.drawing_mode !== 'text') return super.onmousereset(e);
		this.is_mouse_down = false;
	}
	
}