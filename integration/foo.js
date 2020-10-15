
// // assert field length
// suite.assert(done => {
//   const req = {
//     index: suite.props.index,
//     type: config.schema.typeName,
//     id: '1',
//     fields: 'name.default',
//     term_statistics: true
//   }

//   suite.client.termvectors(req, (err, res) => {
//     // console.error(err, JSON.stringify(res, null, 2));

//     const field_statistics = _.get(res, 'term_vectors["name.default"].field_statistics')
//     const sum_doc_freq = _.get(field_statistics, 'sum_doc_freq')
//     const doc_count = _.get(field_statistics, 'doc_count')
//     const sum_ttf = _.get(field_statistics, 'sum_ttf')

//     /**
//      *         "a": {
//       "doc_freq": 1,
//       "ttf": 3,
//       "term_freq": 3,
//       "tokens": [
//         {
//           "position": 206,
//           "start_offset": 35,
//           "end_offset": 42
//         },
//         {
//           "position": 307,
//           "start_offset": 43,
//           "end_offset": 50
//         },
//         {
//           "position": 412,
//           "start_offset": 72,
//           "end_offset": 79
//         }
//       ]
//     },
//      */
//     const terms = _.get(res, 'term_vectors["name.default"].terms')

//     console.error('name.default total terms', _.size(terms))
//     done()
//   })
// })
