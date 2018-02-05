import Vue from "vue";
import VMapbox from "./components/VMapbox";
import VMapboxLayer from "./components/VMapboxLayer";
import VMapboxSource from "./components/VMapboxSource";
import VMapboxGeocoder from "./components/VMapboxGeocoder";
import VMapboxNavigationControl from "./components/VMapboxNavigationControl";
import Vuetify from "vuetify";

Vue.use(Vuetify);

import "normalize.css";
import "sanitize.css";
import "vuetify/dist/vuetify.min.css";
import "material-design-icons/iconfont/material-icons.css";
import "./main.scss";
/* eslint-disable no-new */
import mapboxgl from 'mapbox-gl';

var scenarios = require("./APIsources.js").scenarios()

Vue.component('modal', {
  template: '#modal-template'
})


function api_source(source_id) {
  // This function is used to get all locations of a specific source
  // for now source_id=fews or sourc_id=aquadesk. Send a asynchronous
  // get request to API of the specified source.

  var baseurl = scenarios.find(x => x.id === source_id).baseurl
  var response = $.ajax({
    url: baseurl + '/locations?pagesize=100000',
    async: false
  }).responseJSON;
  var coordinates = _.map(response.results, 'geometry')
  var geojsonarray = []
  _.each(response.results, function(r) {
    geojsonarray.push({
      "type": "Feature",
      "geometry": r.geometry,
      "properties": _.pick(r, 'uuid', 'url', 'code', 'name')
    })
  })
  var source = {
    "type": "geojson",
    "data": {
      "type": "FeatureCollection",
      "features": geojsonarray
    }
  }
  return source
}

function url_sources(scenarios) {
  //
  var s = []
  _.each(scenarios, (e) => {
    s.push(e.id)
  })
  return s
}

const vm = new Vue({
  el: "#app",
  data() {
    return {
      urls: url_sources(scenarios),
      selected: _.first(this.urls),
      // layers includes all layers to be made on top of the mapbox component
      layers: [{
          "id": "aquadesk",
          "active": false,
          "type": "circle",
          "source": api_source("aquadesk"),
          "minzoom": 5,
          "layout": {
            "visibility": "none"
          },
          "paint": {
            "circle-radius": 8
          }
        }
        // ,
        // {
        //   "id": "fews",
        //   "active": false,
        //   "type": "circle",
        //   "source": api_source("fews"),
        //   "minzoom": 5,
        //   "layout": {
        //     "visibility": "none"
        //   },
        //   "paint": {
        //     "circle-radius": 8
        //   }
        // }
      ],
      // Either define here sources to be used, or directly in the layers
      sources: []
    };
  },

  // import all components from components folder
  components: {
    "v-mapbox": VMapbox,
    "v-mapbox-layer": VMapboxLayer,
    "v-mapbox-source": VMapboxSource,
    "v-mapbox-geocoder": VMapboxGeocoder,
    "v-mapbox-navigation-control": VMapboxNavigationControl,
  },
  // When mounted execute the following
  mounted() {
    this.$nextTick(() => {
      // create an empty popup on top of mapbox, this will be filled up when a
      // mouse event is triggered.
      var popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
      });
      this.$refs.map.map.on('load', () => {
        console.log('loaded', this.layers)
        // When the mouse enters a feature of a layer
        _.each(this.layers, (layer) => {
          this.$refs.map.map.on("mouseenter", layer.id, (e) => {
            // change cursor to a pointer and show popup with information
            this.$refs.map.map.getCanvas().style.cursor = 'pointer';
            popup.setLngLat(e.lngLat)
              .setHTML("Location: " + e.features[0].properties.name + " (Code: " + e.features[0].properties.code + ")")
              .addTo(this.$refs.map.map);
          });
        });

        // When mouse leaves a layer
        _.each(this.layers, (layer) => {
          this.$refs.map.map.on('mouseleave', layer.id, () => {
            // cursors changes back to default and Popup will be removed
            this.$refs.map.map.getCanvas().style.cursor = '';
            popup.remove();
          });
        });

        // When clicked on a feature in a layer
        _.each(this.layers, (layer) => {
          this.$refs.map.map.on('click', layer.id, (e) => {
            // reset the details div
            $('#details').css('display', 'none')

            // Should be looking by locationCode, for fews use uuid.
            if (layer.id == 'fews') {
              var searchterm = 'uuid'
            } else {
              var searchterm = 'locationCode'
            }

            // send get request to get all timeseries by selected searchterm
            var response = $.ajax({
              url: scenarios.find(x => x.id === layer.id).baseurl + '/timeseries?' + searchterm + '=' + e.features[0].properties.code + '&pagesize=3000',
              async: false
            }).responseJSON;
            var t = $("table#results tbody").empty();

            // Create list of timeseries within the table
            $('.panel-heading').html("<h6> Information on " + e.features[0].properties.name + "<br>(Code: " + e.features[0].properties.code + ")</h6>")
            try {
              response.results.forEach(res => {
                if (typeof(res.observationType) == "string") {
                  var obs = $.ajax({
                    url: res.observationType,
                    async: false
                  }).responseJSON;
                  var quantity = obs.quantity
                } else {
                  var quantity = res.observationType.quantity
                }

                // When clicked on one in table create plot using that parameterCode
                $("<tr><td class='results'>" + quantity + " (" + res.observationType.parameterCode + ") </td></tr>").appendTo(t)
                  .click(function(data) {
                    $('#details').css('display', 'inline-block')
                    $('#details').empty()
                    $('#details').html()

                    // Create Bokeh Plot, tools
                    var plt = Bokeh.Plotting;
                    var tools = "pan,crosshair,wheel_zoom,box_zoom,reset,save"

                    var unit = res.observationType.unit

                    // Get data according to location and paramater
                    var ydata = $.ajax({
                      url: res.url + '/data',
                      async: false
                    }).responseJSON;

                    // Creaet empty arrays
                    var x = []
                    var y = []

                    // Fill arrays with Date range and data from get request
                    _.each(ydata, function(event) {
                      try {
                        x.push(new Date(event.timestamp.slice(0, 19)))
                      } catch (err) {
                        x.push(new Date(event.timeStamp.slice(0, 19)))
                      }
                      y.push(event.value)
                    });

                    // Create range to view in the plot, when timeseries, it would
                    // work with first and last, with only one point, use one day
                    // before and after in the xdr range...
                    var startdate = new Date(x[0])
                    var enddate = new Date(x.slice(-1)[0])
                    var xdr = new Bokeh.Range1d({
                      start: startdate.setDate(x[0].getDate() - 1),
                      end: enddate.setDate(x.slice(-1)[0].getDate() + 1)
                    })

                    // Set data in a columndatasource and create a plot, important
                    // set x_axis_type to 'datetime' for this range!
                    var source = new Bokeh.ColumnDataSource({
                      data: {
                        x: x,
                        y: y
                      }
                    });
                    var plot = new plt.figure({
                      title: "Timeseries for " + res.observationType.quantity + " (" + res.observationType.parameterCode + ")",
                      tools: tools,
                      width: 400,
                      height: 200,
                      background_fill_color: "#F2F2F7",
                      x_axis_type: 'datetime',
                      y_axis_label: unit,
                      x_range: xdr
                    });

                    // Create a line. Sometimes the data is only a point, but with
                    // the range we made this should work as well.
                    var line = new Bokeh.Circle({
                      x: {
                        field: "x"
                      },
                      y: {
                        field: "y"
                      },
                      line_color: "#666699",
                      line_width: 2
                    });
                    // add line to the Bokeh plot and add the html of the plot to the details div
                    plot.add_glyph(line, source);
                    Bokeh.Plotting.show(plot, document.getElementById('details'));
                  })
              });
            } catch (err) {
              var t = $("table#results tbody").empty();
              t.text("No data detected.")
            }
            $('#list').css('display', 'block')
          });
        })
      });
    })
  },
  watch: {
    selected(newScenario, oldScenario) {
      try {
        this.$refs.map.map.setLayoutProperty(oldScenario, "visibility", "none");
      } catch (err) {}
      this.$refs.map.map.setLayoutProperty(newScenario, "visibility", "visible");
    }

  },
  computed: {},
  methods:{
    // For the reset initial view button, could be nicer
    initialview() {
      this.$refs.map.map.setZoom("7.3")
      this.$refs.map.map.setPitch("38.50")
      this.$refs.map.map.setCenter("[5.507, 52.078]")
      this.$refs.map.map.setBearing("1.43")
    }
  }
});
