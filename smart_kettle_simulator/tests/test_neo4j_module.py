from smart_kettle_simulator.neo4j_module.graph_analyzer import GraphAnalyzer


class DummyRepository:
    def get_all_capabilities(self, thing_id):
        return [{"name": "power_control"}]


def test_graph_analyzer_counts_capabilities():
    summary = GraphAnalyzer(DummyRepository()).summarize_capabilities("smart-home:kettle-01")
    assert summary["capability_count"] == 1
