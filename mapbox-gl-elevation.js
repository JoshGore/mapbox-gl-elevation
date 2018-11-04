class ElevationControl {

    constructor(feature) {
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
        this._data = vertices.features.map(feature => [feature.properties.distance, feature.geometry.coordinates[2]]);
    };

    onAdd(map) {
        // store reference to map
        this._map = map;
        // create div for control
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl';
        this._container.id = 'elevation-ctrl';
        // set a width for svg and parent container
        var svgWidth = this._container.style.width = 500;
        var svgHeight = this._container.style.height = 500;
        // set margin and dimensions for svg child
        var margin = { top: 20, right: 20, bottom: 30, left: 50  };
        var width = svgWidth - margin.left - margin.right;
        var height = svgHeight - margin.top - margin.bottom;
        // define scale, dimensions of svg to scale data to and domains, range of data values
        this._x = d3.scaleLinear().range([0, width]).interpolate(d3.interpolateRound)
            .domain(d3.extent(this._data, d => d[0]));
        this._y = d3.scaleLinear().range([height, 0]).interpolate(d3.interpolateRound)
            .domain(d3.extent(this._data, d => d[1]));
        // select parent element
        var element = d3.select(this._container);
        // create svg container and set height/width attributes
        var svg = element.append('svg').style('display', 'block');
        svg.attr("width", svgWidth).attr("height", svgHeight);
        // create group to put plot within, translated by margins, dimensions less margins
        var g = svg.append("g")
            .attr("height", height)
            .attr("width", width)
            .attr("transform", `translate(${margin.left}, ${margin.top})`);
        // add marker to map at start of path
        this._marker = new mapboxgl.Marker().setLngLat(this._vertices.features[0].geometry.coordinates).addTo(this._map);
        // then draw chart in group
        this.drawChart(this._data, g);
        this.addOverlay(this._data, g);
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
        // add polygon area path to group with predefined data and function
        g.append("path")
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
            .style('stroke', 'steelblue')
            .style('stroke-width', '1.5px');
        g.selectAll('.area')
            .style('fill', 'lightsteelblue')
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
            setMarkerByDistance(lineFeature, d[0], marker)
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
