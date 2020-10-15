const _ = require('lodash')
const elastictest = require('elastictest')
const config = require('pelias-config').generate()
const getTotalHits = require('./_hits_total_helper')

const testSimilarityKey = 'schema.settings.index.similarity.testSimilarity'
const IDF = 'double idf = Math.log((field.docCount+1.0)/(term.docFreq+1.0)) + 1.0; return query.boost * idf;'
const examples = {
  BM25: {
    default: {
      type: 'BM25',
      discount_overlaps: true,
      k1: 1,
      b: 0.75
    }
  },
  TFIDF: {
    default: {
      type: 'scripted',
      weight_script: { source: IDF },
      script: {
        source: 'double tf = Math.sqrt(doc.freq); double norm = 1/Math.sqrt(doc.length); return weight * tf * norm;'
      }
    },
    // https://www.elastic.co/guide/en/elasticsearch/painless/current/painless-similarity-context.html
    // https://www.elastic.co/guide/en/elasticsearch/painless/current/painless-api-reference-shared.html
    custom: {
      type: 'scripted',
      weight_script: { source: IDF },
      script: {
        source: 'double tf = doc.freq>0?1:0; double norm = 1/Math.log1p(doc.length); return weight * tf * norm;'
      }
    }
  }
}

const testSimilarityConfig = examples.BM25.default

const testMappingKey = 'schema.mappings.properties.test'
const testMappingConfig = {
  type: 'nested',
  properties: {
    token: {
      type: 'text',
      analyzer: 'standard',
      search_analyzer: 'standard',
      similarity: 'testSimilarity'
    }
  }
}

module.exports.tests = {}

/**
 * adding additional multi value fields (aliases) should not
 * change (lower!) the similarity score.
 */
module.exports.tests.multi_value_field = (test, common) => {
  test('multi value field', (t) => {
    // const schema = _.cloneDeep(common.create);
    const schema = {}
    _.set(schema, testSimilarityKey, testSimilarityConfig)
    _.set(schema, testMappingKey, testMappingConfig)

    var suite = new elastictest.Suite(common.clientOpts, schema)
    suite.action(done => { setTimeout(done, 500) }) // wait for es to bring some shards up

    // index document with a single value (no aliases)
    suite.action(done => {
      suite.client.index({
        index: suite.props.index,
        type: config.schema.typeName,
        id: '1',
        body: {
          test: [
            { token: 'apple' }
          ]
        }
      }, done)
    })

    // index document with a multi values (with aliases)
    suite.action(done => {
      suite.client.index({
        index: suite.props.index,
        type: config.schema.typeName,
        id: '2',
        body: {
          test: [
            { token: 'apple' },
            { token: 'banana' },
            { token: 'coconut' }
          ]
        }
      }, done)
    })

    // search for term 'apple' which exists in both
    suite.assert(done => {
      suite.client.search({
        index: suite.props.index,
        type: config.schema.typeName,
        searchType: 'dfs_query_then_fetch',
        body: {
          explain: true,
          query: {
            nested: {
              path: 'test',
              query: {
                match: {
                  'test.token': {
                    analyzer: 'standard',
                    query: 'apple'
                  }
                }
              }
            }
          }
        }
      }, (err, res) => {
        t.equal(err, undefined)
        t.equal(getTotalHits(res.hits), 2, 'both documents matched')
        t.equal(res.hits.hits[0]._score, res.hits.hits[1]._score, 'document scores are equal')

        // console.error(JSON.stringify(res.hits.hits, null, 2))
        // console.error(res.hits.hits.map(h => `${h._id}:${h._score}`))
        done()
      })
    })

    suite.run(t.end)
  })
}

/**
 * shorter fields should score higher than longer fields
 */
module.exports.tests.shorter_fields = (test, common) => {
  test('shorter fields', (t) => {
    // const schema = _.cloneDeep(common.create);
    const schema = {}
    _.set(schema, testSimilarityKey, testSimilarityConfig)
    _.set(schema, testMappingKey, testMappingConfig)

    var suite = new elastictest.Suite(common.clientOpts, schema)
    suite.action(done => { setTimeout(done, 500) }) // wait for es to bring some shards up

    // index document with a single value (no aliases)
    suite.action(done => {
      suite.client.index({
        index: suite.props.index,
        type: config.schema.typeName,
        id: '1',
        body: {
          test: [
            { token: 'apple' }
          ]
        }
      }, done)
    })

    // index document with a multi values (with aliases)
    suite.action(done => {
      suite.client.index({
        index: suite.props.index,
        type: config.schema.typeName,
        id: '2',
        body: {
          test: [
            { token: 'apple cake' }
          ]
        }
      }, done)
    })

    // index document with a many multi values (many aliases)
    suite.action(done => {
      suite.client.index({
        index: suite.props.index,
        type: config.schema.typeName,
        id: '3',
        body: {
          test: [
            { token: 'apple birthday cake is yummy' },
            { token: 'apple pie' },
            { token: 'apple bake' },
            { token: 'apple crumble' },
            { token: 'apple slices' }
          ]
        }
      }, done)
    })

    // search for term 'apple' which exists in all
    suite.assert(done => {
      suite.client.search({
        index: suite.props.index,
        type: config.schema.typeName,
        searchType: 'dfs_query_then_fetch',
        body: {
          explain: true,
          query: {
            nested: {
              path: 'test',
              query: {
                match: {
                  'test.token': {
                    analyzer: 'standard',
                    query: 'apple'
                  }
                }
              }
            }
          }
        }
      }, (err, res) => {
        t.equal(err, undefined)
        t.equal(getTotalHits(res.hits), 3, 'all documents matched')

        t.deepEqual(res.hits.hits.map(h => h._id), ['1', '2', '3'], 'document order')
        t.true(res.hits.hits[0]._score > res.hits.hits[1]._score, 'shorter fields should score higher')
        t.true(res.hits.hits[1]._score > res.hits.hits[2]._score, 'shorter fields should score higher')

        // console.error(JSON.stringify(res.hits.hits, null, 2))
        // console.error(res.hits.hits.map(h => `${h._id}:${h._score}`))
        done()
      })
    })

    suite.run(t.end)
  })
}

module.exports.all = (tape, common) => {
  function test (name, testFunction) {
    return tape('similarity (nested): ' + name, testFunction)
  }

  for (var testCase in module.exports.tests) {
    module.exports.tests[testCase](test, common)
  }
}
