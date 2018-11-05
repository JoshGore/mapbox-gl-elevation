class ElevationControl {

    constructor(feature, options={}) {
        /* options format
         * {
         * dimensions: {height: 15%, width: 15%}, (or as int for pixels)
         * margins: {top: 0, left: 0, right: 0, bottom: 0},
         * graphOffset: {height: 0, right: 0, left: 0},
         * graphColor: 'lightsteelblue',
         * graphLineColor: 'steelblue',
         * graphOpacity: 1,
         * icon: , // if not present no marker, if true default marker
         * summary: false,
         * }
         */
        this._options = {};
        // create dimensions object if not in options
        options.hasOwnProperty('dimensions') ? this._options.dimensions = options.dimensions : (this._options.dimensions = {});
        // create margins object if not in options
        options.hasOwnProperty('margins') ? this._options.margins = options.margins : (this._options.margins = {});
        // define margins if not already set
        !this._options.margins.hasOwnProperty('top') && (this._options.margins.height = 0);
        !this._options.margins.hasOwnProperty('left') && (this._options.margins.height = 0);
        !this._options.margins.hasOwnProperty('right') && (this._options.margins.right = 0);
        !this._options.margins.hasOwnProperty('bottom') && (this._options.margins.left = 0);
        // define graphOffset object if not already set
        options.hasOwnProperty('graphOffset') ? this._options.graphOffset = options.graphOffset : (this._options.graphOffset = {});
        // define individual values of graphOffset
        !this._options.graphOffset.hasOwnProperty('height') && (this._options.graphOffset.height = 0);
        !this._options.graphOffset.hasOwnProperty('left') && (this._options.graphOffset.height = 0);
        !this._options.graphOffset.hasOwnProperty('right') && (this._options.graphOffset.right = 0);
        // assign/define graph area color
        this._options.graphColor = options.hasOwnProperty('graphColor') ? options.graphColor : 'lightsteelblue';
        // assign/define graph area opacity
        this._options.graphOpacity = options.hasOwnProperty('graphOpacity') ? options.graphOpacity : 1;
        // assign/define graph line color
        this._options.graphLineColor = options.hasOwnProperty('graphLineColor') ? options.graphLineColor : 'steelblue';
        // assign icon if existing, true if default, leave if not defined
        options.hasOwnProperty('icon') ? (this._options.icon = options.icon) : (this._options.icon = false);
        this._feature = feature;
        var vertices = turf.explode(feature);
        vertices.features.forEach(vertex => {
            vertex.properties = {...vertex.properties};
        })
        vertices["features"].map((feature, index, features) => {
            index == 0 ? feature["properties"]["distance"] = 0 : 
                feature["properties"]["distance"] = turf.distance(features[index - 1], feature) + features[index - 1].properties.distance;
        });
        this._vertices = vertices;
        this._value = vertices.features.map(feature => [feature.properties.distance, feature.geometry.coordinates[2]]);
    };

    onAdd(map) {
        // store reference to map
        this._map = map;
        // parse width and height options
        if (this._options.dimensions.hasOwnProperty('width')) {
            if (this._options.dimensions.width.charAt(this._options.dimensions.width.length - 1) == '%') {
                this._options.dimensions.width = this._map._container.clientWidth * (Number(this._options.dimensions.width.slice(0, -1))/100);
            }
        }
        else {
            this._options.dimensions.width = this._map._container.clientWidth * 0.5; 
        }
        if (this._options.dimensions.hasOwnProperty('height')) {
            if (this._options.dimensions.height.charAt(this._options.dimensions.height.length - 1) == '%') {
                this._options.dimensions.height = this._map._container.clientHeight * (Number(this._options.dimensions.height.slice(0, -1))/100);
            }
        }
        else {
            this._options.dimensions.height = this._map._container.clientHeight * 0.5; 
        }

        // svgHeight to this._options.height
        // create div for control
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl';
        this._container.id = 'elevation-ctrl';
        // set a width for svg and parent container
        this._container.style.width = this._options.dimensions.width;
        this._container.style.height = this._options.dimensions.height;
        // set margin and dimensions for svg child
        // var margin = { top: 20, right: 20, bottom: 30, left: 50  };
        var margin = this._options.margins;
        var width = this._options.dimensions.width - margin.left - margin.right;
        var height = this._options.dimensions.height - margin.top - margin.bottom;
        // define scale, dimensions of svg to scale data to and domains, range of data values
        this._x = d3.scaleLinear().range([0, width]).interpolate(d3.interpolateRound)
            .domain(d3.extent(this._value, d => d[0]));
        this._y = d3.scaleLinear().range([(height), 0]).interpolate(d3.interpolateRound)
            .domain(d3.extent(this._value, d => d[1]));
        // select parent element
        var element = d3.select(this._container);
        // create svg container and set height/width attributes
        var svg = element.append('svg').style('display', 'block');
        svg.attr("width", this._options.dimensions.width).attr("height", this._options.dimensions.height);
        // create group to put plot within, translated by margins, dimensions less margins
        var graphs = svg.append("g")
            .attr("height", (height))
            .attr("width", width)
            .attr("transform", `translate(${margin.left}, ${margin.top})`);
        // create overlay group
        var overlay = svg.append("g")
            .attr("height", (height))
            .attr("width", width)
            .attr("transform", `translate(${margin.left}, ${margin.top})`);
        // add marker to map at start of path
        if (this._options.icon) {
            this._marker = new mapboxgl.Marker(!(this._options.icon === true) && this._options.icon).setLngLat(this._vertices.features[0].geometry.coordinates).addTo(this._map);
        }
        else {
            this._marker = false;
        }
        // then draw chart in group
        this.drawChart(this._value, graphs);
        this.addOverlay(this._value, overlay);
        return this._container;
    };
    
    drawChart(data, g) {
        // get height and width of parent element
        const width = g.attr('width');
        const height = g.attr('height');
        const transform = g.attr('transform');
        // define line and area functions calling scale functions on each variable
        let area = d3.area()
            .x(d => this._x(d[0]))
            .y0(height)
            .y1(d => this._y(d[1]));
        let line = d3.line()
            .x(d => this._x(d[0]))
            .y(d => this._y(d[1]));
        // create group for areas
        const areas = g.append('g').attr("opacity", this._options.graphOpacity);
        // add polygon area path to group with predefined data and function
        areas.append("path")
            .datum(data)
            .attr("class", "area")
            .attr("d", area);
        // add polygon line path to group with predefined data and function
        g.append("path")
            .datum(data)
            .attr("class", "line")
            .attr("d", line);
        // style line and area
        g.selectAll('.line')
            .style('fill', 'none')
            .style('stroke', this._options.graphLineColor)
            .style('stroke-width', '1.5px');
        g.selectAll('.area')
            .style('fill', this._options.graphColor)
    };

    addOverlay(data, g) {
        const x = this._x;
        const y = this._y;
        // get height, width, transform of parent element
        const width = g.attr('width');
        const height = g.attr('height');
        const transform = g.attr('transform');
        // create group to store marker/dropdowns
        const focus = g.append('g')
            .attr('class', 'focus')
            .style('display', 'none');
        // add circle marker
        focus.append('circle')
            .attr('r', 4.5);
        // append x and y lines with respective classes 
        focus.append('line')
            .attr('class',  'x');
        focus.append('line')
            .attr('class',  'y');
        // appends rectangle over svg with event listners for mouseover, out, move
        this._overlay = g.append('rect')
            .attr('class', 'overlay')
            .attr('width', width)
            .attr('height', height);
        this._overlay
            .on('mouseover', () => focus.style('display', null))
            .on('mouseout', () => focus.style('display', 'none'))
            .on('mousemove', mousemove);

        // style elements 
        g.select('.overlay')
            .style('fill', 'none')
            .style('pointer-events', 'all');
        g.selectAll('.focus')
            .style('opacity', 0.7);
        g.selectAll('.focus circle')
            .style('fill', 'none')
            .style('stroke', 'black');
        g.selectAll('.focus line')
            .style('fill', 'none')
            .style('stroke', 'black')
            .style('stroke-width', '1.5px')
            .style('stroke-dasharray', '3 3');
        const setMarkerByDistance = this.setMarkerByDistance;
        const lineFeature = this._feature;
        const marker = this._marker;
        function mousemove() {
            // d3.mouse(this) returns [x, y] of mouse
            // x0 uses scale.invert to get real value from x value

            // const element = d3.select(this._container).select('.overlay');
            const x0 = x.invert(d3.mouse(this)[0]);
            // bisector gets nearest value to the left of d
            const bisectDistance = d3.bisector(d => d[0]).left;
            const i = bisectDistance(data, x0, 1);
            const d = data[i];
            // const i = bisectDate(data, x0, 1);
            // const d0 = data[i - 1];
            // const d1 = data[i];
            // const d = x0 - d0.date > d1.date - x0 ? d1 : d0;
            focus.attr('transform', `translate(${x(d[0])}, ${y(d[1])})`);
            focus.select('line.x')
                .attr('x1', 0)
                .attr('x2', -x(d[0]))
                .attr('y1', 0)
                .attr('y2', 0);

            focus.select('line.y')
                .attr('x1', 0)
                .attr('x2', 0)
                .attr('y1', 0)
                .attr('y2', height - y(d[1]));
            marker && setMarkerByDistance(lineFeature, d[0], marker)
        };
    }

    setMarkerByDistance(feature, distance, marker) {
        const latLng = turf.along(feature, distance).geometry.coordinates;
        marker.setLngLat([latLng[0], latLng[1]]);
    };

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    };
}
