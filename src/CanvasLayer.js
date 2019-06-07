
/**
 * Class representing the layers drawn on the canvas.
 */
class CanvasLayer{
	
	/**
	 * Create a new Layer.
	 * @param {String} url - The URL or URI of an image to draw on the canvas.
	 * @param {String} name - The name of the layer.
	 * @param {Number} x - The x position of the layer on the canvas.
	 * @param {Number} y - The y position of the layer on the canvas.
	 * @param {Number} [width=null] - The width of the layer on the canvas.
	 * @param {Number} [height=null] - The height of the layer on the canvas.
	 * @param {Number} [rotation=0] - The rotation of the layer on the canvas.
	 * @param {Boolean} [draggable=true] - Is the layer draggable?
	 * @param {Boolean} [rotateable=true] - Is the layer rotateable?
	 * @param {Boolean} [resizable=true] - Is the layer resizable?
	 * @param {Boolean} [selectable=true] - Is the layer selectable?
	 * @param {Boolean} [forceBoundary=false] - Force the layer to stay in bounds?
	 * @returns {CanvasLayer}
	 */
	constructor(url, name, x, y, width=null, height=null, rotation=0, draggable=true, rotateable=true, resizable=true, selectable=true, forceBoundary=false){
		this.name = name;
		this.url = url;
		this.ready = false;
		this.image = null;
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		this.rotation = rotation;
		this.draggable = draggable;
		this.rotateable = rotateable;
		this.resizable = resizable;
		this.selectable = selectable;
		this.forceBoundary = forceBoundary;
		this.load_cb_stack = [];
		this.load();
	}
	
	/**
	 * Register a function to be called when the layer is fully loaded.
	 * @param {Function} fn - The callback function.
	 * @returns {undefined}
	 */
	onload(fn){
		if(this.ready){
			fn();
			return;
		}else{
			this.load_cb_stack.push(fn);
		}
	}
	
	/**
	 * Load the layer so it is ready to use.
	 * @returns {Promise} - A promise that resolves when the layer is ready
	 */
	load(){
		return new Promise(done=>{
			if(this.ready){
				done();
			}else{
				const img = new Image();
				img.onload = ()=>{
					this.image = img;
					if(this.width===null) this.width = img.width;
					if(this.height===null) this.height = img.height;
					this.ready = true;
					this.load_cb_stack.forEach(fn=>fn());
					this.load_cb_stack = [];
				};
				img.src = this.url;
			}
		});
	}
	
	/**
	 * Get the relative position of all the corners.
	 * @ignore
	 */
	getCorners(){
		return [
			{x:-(this.width/2), y:-(this.height/2)},
			{x:-(this.width/2)+this.width, y:-(this.height/2)},
			{x:-(this.width/2)+this.width, y:-(this.height/2)+this.height},
			{x:-(this.width/2), y:-(this.height/2)+this.height}
		];
	}
	
}