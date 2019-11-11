(function($) {
    // TODO: make the node ID configurable
    var treeNode = $('#jsdoc-toc-nav');

    // initialize the tree
    treeNode.tree({
        autoEscape: false,
        closedIcon: '&#x21e2;',
        data: [{"label":"<a href=\"Canvas.html\">Canvas</a>","id":"Canvas","children":[]},{"label":"<a href=\"CanvasLayer.html\">CanvasLayer</a>","id":"CanvasLayer","children":[]},{"label":"<a href=\"CanvasLayerGroup.html\">CanvasLayerGroup</a>","id":"CanvasLayerGroup","children":[]},{"label":"<a href=\"DrawingCanvas.html\">DrawingCanvas</a>","id":"DrawingCanvas","children":[]}],
        openedIcon: ' &#x21e3;',
        saveState: true,
        useContextMenu: false
    });

    // add event handlers
    // TODO
})(jQuery);
