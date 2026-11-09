"""Offline regression tests. Run: python -m unittest -v test_regressions"""
import asyncio
import unittest
from unittest.mock import AsyncMock, patch

import httpx
import sympy as sp
from fastapi.testclient import TestClient

from main import app
from app import ollama_client, summarize, verify


class MathTests(unittest.TestCase):
    def test_linear_equations(self):
        for equation, answer in [('2x+3=11', 'x = 4'), ('-x+4=-2', 'x = 6'),
                                 ('0.5x+0.1=0.3', 'x = 2/5')]:
            with self.subTest(equation=equation):
                result = verify.verify_equation(equation)
                self.assertIn(answer, result)
                self.assertIn('not the AI explanation', result)

    def test_invalid_or_unsupported_equations(self):
        for equation in [None, '', 'hello', '0x+3=11', '__import__("os")', 'x**2=4']:
            self.assertIsNone(verify.verify_equation(equation))

    def test_sympy_equivalence_available(self):
        # Capability check: the application does not expose a general equivalence API.
        x = sp.Symbol('x')
        self.assertEqual(sp.simplify((x + 1)**2 - (x*x + 2*x + 1)), 0)

    def test_current_and_legacy_text(self):
        rich = {'type': 'doc', 'content': [{'type': 'paragraph', 'content': [
            {'type': 'text', 'text': '2x+3=11'}]}]}
        for props in [{'text': '2x+3=11'}, {'richText': rich}]:
            self.assertIn('2x+3=11', summarize.summarize_canvas([{'type': 'text', 'props': props}]))

    def test_freehand_is_not_recognized(self):
        summary = summarize.summarize_canvas([{'type': 'draw', 'props': {'segments': []}}])
        self.assertIn('not readable as symbols', summary)


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_reachable_empty_server(self):
        with patch.object(ollama_client, 'list_models', AsyncMock(return_value=[])):
            self.assertEqual(self.client.get('/api/models').json()['ollama'], 'connected')
            with self.client.websocket_connect('/ws/chat') as ws:
                ws.send_json({'id': 1, 'model': 'test'})
                result = ws.receive_json()
                self.assertIn('no chat models', result['error'])

    def test_unreachable_server(self):
        with patch.object(ollama_client, 'list_models', AsyncMock(side_effect=RuntimeError('Connection failed'))):
            self.assertEqual(self.client.get('/api/health').json()['status'], 'degraded')
            with self.client.websocket_connect('/ws/chat') as ws:
                ws.send_json({'id': 2})
                self.assertEqual(ws.receive_json()['error'], 'Connection failed')

    def test_image_wire_format_and_rich_text(self):
        models = [{'name': 'test', 'vision': True}]
        chat = AsyncMock(return_value='x = 999 (deliberately wrong)')
        with patch.object(ollama_client, 'list_models', AsyncMock(return_value=models)), patch.object(ollama_client, 'chat', chat):
            with self.client.websocket_connect('/ws/chat') as ws:
                ws.send_json({'id': 3, 'model': 'test', 'mode': 'analyze', 'image_base64': 'YWJj',
                              'shapes': [{'type': 'text', 'props': {'text': '2x+3=11'}}]})
                self.assertEqual(ws.receive_json()['status'], 'thinking')
                result = ws.receive_json()
                self.assertEqual(result['status'], 'done')
                self.assertIn('not the AI explanation', result['verified'])
        message = chat.call_args.args[1][-1]
        self.assertIsInstance(message['content'], str)
        self.assertIn('2x+3=11', message['content'])
        self.assertEqual(message['images'], ['YWJj'])

    def test_model_compatibility(self):
        with patch.object(ollama_client, 'list_models', AsyncMock(return_value=[{'name': 'text', 'vision': False}])):
            with self.client.websocket_connect('/ws/chat') as ws:
                ws.send_json({'id': 4, 'model': 'missing'})
                self.assertIn('not an installed chat model', ws.receive_json()['error'])
                ws.send_json({'id': 5, 'model': 'text', 'image_base64': 'YWJj'})
                self.assertEqual(ws.receive_json()['status'], 'thinking')
                self.assertIn('does not support image input', ws.receive_json()['error'])

    def test_embedding_models_filtered(self):
        original = httpx.AsyncClient
        def handler(request):
            if request.url.path == '/api/tags':
                return httpx.Response(200, json={'models': [
                    {'name': 'embed', 'capabilities': ['embedding']},
                    {'name': 'chat', 'capabilities': ['completion']}]})
            return httpx.Response(200, json={'capabilities': ['completion']})
        with patch.object(ollama_client.httpx, 'AsyncClient', lambda **kw: original(transport=httpx.MockTransport(handler), **kw)):
            self.assertEqual(asyncio.run(ollama_client.list_models()), [{'name': 'chat', 'vision': False}])


if __name__ == '__main__':
    unittest.main()
